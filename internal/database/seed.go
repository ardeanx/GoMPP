package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

// SeedSuperAdmin creates the initial super-admin
func SeedSuperAdmin(ctx context.Context, db *pgxpool.Pool) error {
	var count int
	err := db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("checking for existing admin: %w", err)
	}
	if count > 0 {
		log.Debug().Int("admin_count", count).Msg("admin user(s) already exist, skipping seed")
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), 12)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	_, err = db.Exec(ctx, `
		INSERT INTO users (email, username, password_hash, role, is_active)
		VALUES ($1, $2, $3, 'admin', true)
		ON CONFLICT (email) DO NOTHING
	`, "admin@gompp.dev", "admin", string(hash))
	if err != nil {
		return fmt.Errorf("inserting super admin: %w", err)
	}

	log.Info().Str("email", "admin@gompp.dev").Msg("super admin user seeded (password: admin123)")
	return nil
}
