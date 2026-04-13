package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate runs all pending SQL migrations
func Migrate(ctx context.Context, db *pgxpool.Pool) error {
	// Ensure tracking table exists
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("creating schema_migrations table: %w", err)
	}

	// Read all .sql files from the directory
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("reading migration files: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	// Get already-applied migrations
	applied := make(map[string]bool)
	rows, err := db.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("querying applied migrations: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return err
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Apply pending migrations
	for _, filename := range files {
		if applied[filename] {
			continue
		}

		content, err := migrationFS.ReadFile("migrations/" + filename)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", filename, err)
		}

		// Extract the "Up" portion only
		sql := extractUpSQL(string(content))
		if sql == "" {
			log.Warn().Str("file", filename).Msg("skipping migration: no +goose Up section found")
			continue
		}

		log.Info().Str("file", filename).Msg("applying migration")

		tx, err := db.Begin(ctx)
		if err != nil {
			return fmt.Errorf("beginning transaction for %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, sql); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("executing migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, filename); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("recording migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("committing migration %s: %w", filename, err)
		}

		log.Info().Str("file", filename).Msg("migration applied")
	}

	return nil
}

// If no markers are found, returns the entire content.
func extractUpSQL(content string) string {
	upIdx := strings.Index(content, "-- +goose Up")
	downIdx := strings.Index(content, "-- +goose Down")

	if upIdx == -1 {
		return content
	}

	start := upIdx + len("-- +goose Up")
	if downIdx == -1 {
		return strings.TrimSpace(content[start:])
	}
	return strings.TrimSpace(content[start:downIdx])
}
