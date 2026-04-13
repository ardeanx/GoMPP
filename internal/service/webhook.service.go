package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/metrics"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

type WebhookService struct {
	repo   *repository.WebhookRepository
	client *http.Client
}

func NewWebhookService(repo *repository.WebhookRepository) *WebhookService {
	return &WebhookService{
		repo: repo,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Fire sends a webhook event to all subscribed endpoints.
func (s *WebhookService) Fire(ctx context.Context, eventType string, data any) {
	webhooks, err := s.repo.ListByEvent(ctx, eventType)
	if err != nil {
		log.Error().Err(err).Str("event", eventType).Msg("failed to list webhooks")
		return
	}

	payload := map[string]any{
		"event":     eventType,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      data,
	}

	for _, wh := range webhooks {
		go s.deliver(context.Background(), wh, eventType, payload, 1)
	}
}

func (s *WebhookService) deliver(ctx context.Context, wh model.Webhook, eventType string, payload any, attempt int) {
	body, _ := json.Marshal(payload)
	sig := signPayload(body, wh.Secret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wh.URL, bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Str("webhook_id", wh.ID.String()).Msg("failed to create webhook request")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GoMPP-Signature", sig)
	req.Header.Set("X-GoMPP-Event", eventType)

	start := time.Now()
	resp, err := s.client.Do(req)
	durationMs := int(time.Since(start).Milliseconds())

	delivery := &model.WebhookDelivery{
		WebhookID:  wh.ID,
		EventType:  eventType,
		Payload:    payload,
		DurationMs: &durationMs,
		Attempt:    attempt,
	}

	if err != nil {
		delivery.Success = false
		_ = s.repo.CreateDelivery(ctx, delivery)
		if attempt < 3 {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
			s.deliver(ctx, wh, eventType, payload, attempt+1)
		}
		return
	}
	defer resp.Body.Close()

	delivery.ResponseStatus = &resp.StatusCode
	delivery.Success = resp.StatusCode >= 200 && resp.StatusCode < 300
	_ = s.repo.CreateDelivery(ctx, delivery)

	if delivery.Success {
		metrics.WebhookDeliveriesTotal.WithLabelValues(eventType, "true").Inc()
	} else {
		metrics.WebhookDeliveriesTotal.WithLabelValues(eventType, "false").Inc()
	}
	metrics.WebhookDeliveryDuration.WithLabelValues(eventType).Observe(float64(durationMs) / 1000.0)

	if !delivery.Success && attempt < 3 {
		time.Sleep(time.Duration(attempt*attempt) * time.Second)
		s.deliver(ctx, wh, eventType, payload, attempt+1)
	}
}

func signPayload(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return fmt.Sprintf("sha256=%s", hex.EncodeToString(mac.Sum(nil)))
}
