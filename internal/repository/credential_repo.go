package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type CredentialRepository struct {
	db *pgxpool.Pool
}

func NewCredentialRepository(db *pgxpool.Pool) *CredentialRepository {
	return &CredentialRepository{db: db}
}

func (r *CredentialRepository) Create(ctx context.Context, c *model.WebAuthnCredential) error {
	query := `INSERT INTO user_credentials (user_id, credential_id, public_key, attestation_type, aaguid, sign_count, backup_eligible, backup_state, name)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	          RETURNING id, created_at`
	return r.db.QueryRow(ctx, query,
		c.UserID, c.CredentialID, c.PublicKey, c.AttestationType, c.AAGUID, c.SignCount, c.BackupEligible, c.BackupState, c.Name,
	).Scan(&c.ID, &c.CreatedAt)
}

func (r *CredentialRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.WebAuthnCredential, error) {
	query := `SELECT id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, backup_eligible, backup_state, name, created_at
	          FROM user_credentials WHERE user_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var creds []model.WebAuthnCredential
	for rows.Next() {
		var c model.WebAuthnCredential
		if err := rows.Scan(&c.ID, &c.UserID, &c.CredentialID, &c.PublicKey,
			&c.AttestationType, &c.AAGUID, &c.SignCount, &c.BackupEligible, &c.BackupState, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		creds = append(creds, c)
	}
	return creds, rows.Err()
}

func (r *CredentialRepository) GetByCredentialID(ctx context.Context, credID []byte) (*model.WebAuthnCredential, error) {
	query := `SELECT id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, name, created_at
	          FROM user_credentials WHERE credential_id = $1`
	c := &model.WebAuthnCredential{}
	err := r.db.QueryRow(ctx, query, credID).Scan(
		&c.ID, &c.UserID, &c.CredentialID, &c.PublicKey,
		&c.AttestationType, &c.AAGUID, &c.SignCount, &c.Name, &c.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *CredentialRepository) UpdateSignCount(ctx context.Context, credID []byte, count uint32) error {
	query := `UPDATE user_credentials SET sign_count = $2 WHERE credential_id = $1`
	_, err := r.db.Exec(ctx, query, credID, count)
	return err
}

func (r *CredentialRepository) Rename(ctx context.Context, id uuid.UUID, userID uuid.UUID, name string) error {
	query := `UPDATE user_credentials SET name = $3 WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID, name)
	return err
}

func (r *CredentialRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM user_credentials WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID)
	return err
}
