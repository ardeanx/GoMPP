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

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	query := `INSERT INTO users (email, username, password_hash, role)
	          VALUES ($1, $2, $3, $4)
	          RETURNING id, is_active, created_at, updated_at`
	return r.db.QueryRow(ctx, query, u.Email, u.Username, u.PasswordHash, u.Role).
		Scan(&u.ID, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.is_active,
	                 u.avatar_url, u.google_id, u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
	                 (SELECT COUNT(*) FROM user_credentials uc WHERE uc.user_id = u.id)
	          FROM users u WHERE u.id = $1`
	u := &model.User{}
	var googleID *string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.Role,
		&u.IsActive, &u.AvatarURL, &googleID, &u.LastLoginAt, &u.PasswordChangedAt, &u.CreatedAt, &u.UpdatedAt,
		&u.PasskeyCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	u.GoogleID = googleID
	u.HasGoogle = googleID != nil && *googleID != ""
	return u, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.is_active,
	                 u.avatar_url, u.google_id, u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
	                 (SELECT COUNT(*) FROM user_credentials uc WHERE uc.user_id = u.id)
	          FROM users u WHERE u.email = $1`
	u := &model.User{}
	var googleID *string
	err := r.db.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.Role,
		&u.IsActive, &u.AvatarURL, &googleID, &u.LastLoginAt, &u.PasswordChangedAt, &u.CreatedAt, &u.UpdatedAt,
		&u.PasskeyCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	u.GoogleID = googleID
	u.HasGoogle = googleID != nil && *googleID != ""
	return u, err
}

func (r *UserRepository) List(ctx context.Context, page, perPage int, search, role string, isActive *bool) ([]model.User, int, error) {
	where := "WHERE 1=1"
	args := []any{}
	argIdx := 1

	if search != "" {
		where += fmt.Sprintf(" AND (email ILIKE $%d OR username ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if role != "" {
		where += fmt.Sprintf(" AND role = $%d", argIdx)
		args = append(args, role)
		argIdx++
	}
	if isActive != nil {
		where += fmt.Sprintf(" AND is_active = $%d", argIdx)
		args = append(args, *isActive)
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM users " + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT u.id, u.email, u.username, u.password_hash, u.role, u.is_active, u.last_login_at, u.created_at, u.updated_at,
	          (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id AND v.deleted_at IS NULL) AS total_videos_uploaded
	          FROM users u %s ORDER BY u.created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, perPage, (page-1)*perPage)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.Role,
			&u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt, &u.TotalVideosUploaded); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, rows.Err()
}

func (r *UserRepository) Update(ctx context.Context, u *model.User) error {
	query := `UPDATE users SET email = $2, username = $3, role = $4, is_active = $5
	          WHERE id = $1 RETURNING updated_at`
	return r.db.QueryRow(ctx, query, u.ID, u.Email, u.Username, u.Role, u.IsActive).Scan(&u.UpdatedAt)
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	query := `UPDATE users SET password_hash = $2, password_changed_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, hash)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET last_login_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *UserRepository) Deactivate(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET is_active = false WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *UserRepository) UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL string) error {
	query := `UPDATE users SET avatar_url = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, avatarURL)
	return err
}

func (r *UserRepository) GetByGoogleID(ctx context.Context, googleID string) (*model.User, error) {
	query := `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.is_active,
	                 u.avatar_url, u.google_id, u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
	                 (SELECT COUNT(*) FROM user_credentials uc WHERE uc.user_id = u.id)
	          FROM users u WHERE u.google_id = $1`
	u := &model.User{}
	var gid *string
	err := r.db.QueryRow(ctx, query, googleID).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.Role,
		&u.IsActive, &u.AvatarURL, &gid, &u.LastLoginAt, &u.PasswordChangedAt, &u.CreatedAt, &u.UpdatedAt,
		&u.PasskeyCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	u.GoogleID = gid
	u.HasGoogle = gid != nil && *gid != ""
	return u, err
}

func (r *UserRepository) SetGoogleID(ctx context.Context, userID uuid.UUID, googleID string) error {
	query := `UPDATE users SET google_id = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID, googleID)
	return err
}

func (r *UserRepository) ClearGoogleID(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET google_id = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}
