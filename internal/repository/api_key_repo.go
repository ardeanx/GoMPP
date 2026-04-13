package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type ApiKeyRepository struct {
	db *pgxpool.Pool
}

func NewApiKeyRepository(db *pgxpool.Pool) *ApiKeyRepository {
	return &ApiKeyRepository{db: db}
}

func (r *ApiKeyRepository) Create(ctx context.Context, k *model.ApiKey) error {
	query := `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
	          VALUES ($1, $2, $3, $4, $5, $6)
	          RETURNING id, is_active, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		k.UserID, k.Name, k.KeyHash, k.KeyPrefix, k.Scopes, k.ExpiresAt,
	).Scan(&k.ID, &k.IsActive, &k.CreatedAt, &k.UpdatedAt)
}

func (r *ApiKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ApiKey, error) {
	query := `SELECT id, user_id, name, key_hash, key_prefix, scopes, expires_at,
	                 last_used_at, is_active, created_at, updated_at
	          FROM api_keys WHERE id = $1`
	k := &model.ApiKey{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix, &k.Scopes,
		&k.ExpiresAt, &k.LastUsedAt, &k.IsActive, &k.CreatedAt, &k.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return k, err
}

func (r *ApiKeyRepository) GetByHash(ctx context.Context, hash string) (*model.ApiKey, error) {
	query := `SELECT id, user_id, name, key_hash, key_prefix, scopes, expires_at,
	                 last_used_at, is_active, created_at, updated_at
	          FROM api_keys WHERE key_hash = $1`
	k := &model.ApiKey{}
	err := r.db.QueryRow(ctx, query, hash).Scan(
		&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix, &k.Scopes,
		&k.ExpiresAt, &k.LastUsedAt, &k.IsActive, &k.CreatedAt, &k.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return k, err
}

func (r *ApiKeyRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.ApiKey, error) {
	query := `SELECT id, user_id, name, key_hash, key_prefix, scopes, expires_at,
	                 last_used_at, is_active, created_at, updated_at
	          FROM api_keys WHERE user_id = $1
	          ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []model.ApiKey
	for rows.Next() {
		var k model.ApiKey
		if err := rows.Scan(
			&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix, &k.Scopes,
			&k.ExpiresAt, &k.LastUsedAt, &k.IsActive, &k.CreatedAt, &k.UpdatedAt,
		); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (r *ApiKeyRepository) Update(ctx context.Context, k *model.ApiKey) error {
	query := `UPDATE api_keys SET name = $1, scopes = $2, is_active = $3
	          WHERE id = $4`
	_, err := r.db.Exec(ctx, query, k.Name, k.Scopes, k.IsActive, k.ID)
	return err
}

func (r *ApiKeyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM api_keys WHERE id = $1`, id)
	return err
}

func (r *ApiKeyRepository) TouchLastUsed(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, id)
	return err
}
