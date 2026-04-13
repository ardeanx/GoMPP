package model

import (
	"time"

	"github.com/google/uuid"
)

// Webhook represents a webhook endpoint registration.
type Webhook struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Secret    string    `json:"-"`
	Events    []string  `json:"events"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// WebhookDelivery represents a webhook delivery attempt.
type WebhookDelivery struct {
	ID             uuid.UUID `json:"id"`
	WebhookID      uuid.UUID `json:"webhook_id"`
	EventType      string    `json:"event_type"`
	Payload        any       `json:"payload"`
	ResponseStatus *int      `json:"response_status,omitempty"`
	ResponseBody   *string   `json:"response_body,omitempty"`
	DurationMs     *int      `json:"duration_ms,omitempty"`
	Attempt        int       `json:"attempt"`
	DeliveredAt    time.Time `json:"delivered_at"`
	Success        bool      `json:"success"`
}

// CreateWebhookRequest is the payload for creating a webhook.
type CreateWebhookRequest struct {
	Name   string   `json:"name"`
	URL    string   `json:"url"`
	Events []string `json:"events"`
}

// UpdateWebhookRequest is the payload for updating a webhook.
type UpdateWebhookRequest struct {
	Name     *string  `json:"name,omitempty"`
	URL      *string  `json:"url,omitempty"`
	Events   []string `json:"events,omitempty"`
	IsActive *bool    `json:"is_active,omitempty"`
}
