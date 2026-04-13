package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type WebhookRepository struct {
	db *pgxpool.Pool
}

func NewWebhookRepository(db *pgxpool.Pool) *WebhookRepository {
	return &WebhookRepository{db: db}
}

func (r *WebhookRepository) Create(ctx context.Context, w *model.Webhook) error {
	query := `INSERT INTO webhooks (user_id, name, url, secret, events)
	          VALUES ($1, $2, $3, $4, $5)
	          RETURNING id, is_active, created_at, updated_at`
	return r.db.QueryRow(ctx, query, w.UserID, w.Name, w.URL, w.Secret, w.Events).
		Scan(&w.ID, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
}

func (r *WebhookRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Webhook, error) {
	query := `SELECT id, user_id, name, url, secret, events, is_active, created_at, updated_at
	          FROM webhooks WHERE id = $1`
	w := &model.Webhook{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&w.ID, &w.UserID, &w.Name, &w.URL, &w.Secret, &w.Events,
		&w.IsActive, &w.CreatedAt, &w.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return w, err
}

func (r *WebhookRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.Webhook, error) {
	query := `SELECT id, user_id, name, url, secret, events, is_active, created_at, updated_at
	          FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var webhooks []model.Webhook
	for rows.Next() {
		var w model.Webhook
		if err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.URL, &w.Secret, &w.Events,
			&w.IsActive, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		webhooks = append(webhooks, w)
	}
	return webhooks, rows.Err()
}

// ListByEvent returns all active webhooks subscribed to a given event type.
func (r *WebhookRepository) ListByEvent(ctx context.Context, eventType string) ([]model.Webhook, error) {
	query := `SELECT id, user_id, name, url, secret, events, is_active, created_at, updated_at
	          FROM webhooks WHERE is_active = true AND $1 = ANY(events)`
	rows, err := r.db.Query(ctx, query, eventType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var webhooks []model.Webhook
	for rows.Next() {
		var w model.Webhook
		if err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.URL, &w.Secret, &w.Events,
			&w.IsActive, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		webhooks = append(webhooks, w)
	}
	return webhooks, rows.Err()
}

func (r *WebhookRepository) Update(ctx context.Context, w *model.Webhook) error {
	query := `UPDATE webhooks SET name=$2, url=$3, events=$4, is_active=$5
	          WHERE id=$1 RETURNING updated_at`
	return r.db.QueryRow(ctx, query, w.ID, w.Name, w.URL, w.Events, w.IsActive).Scan(&w.UpdatedAt)
}

func (r *WebhookRepository) UpdateSecret(ctx context.Context, id uuid.UUID, secret string) error {
	query := `UPDATE webhooks SET secret = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, secret)
	return err
}

func (r *WebhookRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM webhooks WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *WebhookRepository) CreateDelivery(ctx context.Context, d *model.WebhookDelivery) error {
	query := `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, duration_ms, attempt, success)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	          RETURNING id, delivered_at`
	return r.db.QueryRow(ctx, query,
		d.WebhookID, d.EventType, d.Payload, d.ResponseStatus,
		d.ResponseBody, d.DurationMs, d.Attempt, d.Success,
	).Scan(&d.ID, &d.DeliveredAt)
}
