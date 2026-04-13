package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolConfig holds tuneable connection-pool parameters.
type PoolConfig struct {
	MaxConns           int32
	MinConns           int32
	MaxConnLifetimeMin int
	MaxConnIdleMin     int
	HealthCheckMin     int
}

// Connect creates a new PostgreSQL connection pool.
func Connect(ctx context.Context, dsn string, pc PoolConfig) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parsing database config: %w", err)
	}

	config.MaxConns = pc.MaxConns
	config.MinConns = pc.MinConns
	config.MaxConnLifetime = time.Duration(pc.MaxConnLifetimeMin) * time.Minute
	config.MaxConnIdleTime = time.Duration(pc.MaxConnIdleMin) * time.Minute
	config.HealthCheckPeriod = time.Duration(pc.HealthCheckMin) * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return pool, nil
}
