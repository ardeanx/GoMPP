package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type AccountSessionRepository struct {
	db *pgxpool.Pool
}

func NewAccountSessionRepository(db *pgxpool.Pool) *AccountSessionRepository {
	return &AccountSessionRepository{db: db}
}

func (r *AccountSessionRepository) Create(ctx context.Context, s *model.AccountSession) error {
	query := `INSERT INTO account_sessions (user_id, device_name, device_os, browser, ip_address, location, last_session_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7)
	          RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		s.UserID, s.DeviceName, s.DeviceOS, s.Browser, s.IPAddress, s.Location, s.LastSessionAt,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *AccountSessionRepository) List(ctx context.Context, userID uuid.UUID, page, perPage int) ([]model.AccountSession, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM account_sessions WHERE user_id = $1", userID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT id, user_id, device_name, device_os, browser, ip_address, location, last_session_at, created_at, updated_at
	          FROM account_sessions WHERE user_id = $1 ORDER BY last_session_at DESC LIMIT $2 OFFSET $3`)
	rows, err := r.db.Query(ctx, query, userID, perPage, (page-1)*perPage)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sessions []model.AccountSession
	for rows.Next() {
		var s model.AccountSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceName, &s.DeviceOS, &s.Browser,
			&s.IPAddress, &s.Location, &s.LastSessionAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		sessions = append(sessions, s)
	}
	return sessions, total, rows.Err()
}

func (r *AccountSessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.AccountSession, error) {
	query := `SELECT id, user_id, device_name, device_os, browser, ip_address, location, last_session_at, created_at, updated_at
	          FROM account_sessions WHERE id = $1`
	s := &model.AccountSession{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.UserID, &s.DeviceName, &s.DeviceOS, &s.Browser,
		&s.IPAddress, &s.Location, &s.LastSessionAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return s, err
}

func (r *AccountSessionRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM account_sessions WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID)
	return err
}
