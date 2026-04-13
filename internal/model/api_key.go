package model

import (
	"time"

	"github.com/google/uuid"
)

// ApiKey represents an API key for programmatic access.
type ApiKey struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	Name       string     `json:"name"`
	KeyHash    string     `json:"-"`
	KeyPrefix  string     `json:"key_prefix"`
	Scopes     []string   `json:"scopes"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// CreateApiKeyRequest is the payload to create a new API key.
type CreateApiKeyRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt *string  `json:"expires_at,omitempty"`
}

// CreateApiKeyResponse includes the plain-text key (shown only once).
type CreateApiKeyResponse struct {
	ApiKey   ApiKey `json:"api_key"`
	PlainKey string `json:"key"`
}

// UpdateApiKeyRequest is the payload to update an API key.
type UpdateApiKeyRequest struct {
	Name     *string  `json:"name,omitempty"`
	Scopes   []string `json:"scopes,omitempty"`
	IsActive *bool    `json:"is_active,omitempty"`
}
