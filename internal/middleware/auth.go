package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/metrics"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
)

type contextKey string

const (
	UserIDKey  contextKey = "user_id"
	RoleKey    contextKey = "role"
	AuthMethod contextKey = "auth_method"
)

// Auth returns middleware that validates JWT tokens or API keys.
// It checks the X-API-Key header first, then falls back to Bearer token.
func Auth(authSvc *service.AuthService, apiKeyRepo ...*repository.ApiKeyRepository) func(http.Handler) http.Handler {
	var akRepo *repository.ApiKeyRepository
	if len(apiKeyRepo) > 0 {
		akRepo = apiKeyRepo[0]
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try API key first
			if apiKey := r.Header.Get("X-API-Key"); apiKey != "" && akRepo != nil {
				hash := sha256.Sum256([]byte(apiKey))
				keyHash := hex.EncodeToString(hash[:])

				key, err := akRepo.GetByHash(r.Context(), keyHash)
				if err != nil || key == nil {
					metrics.AuthAttemptsTotal.WithLabelValues("api_key", "invalid").Inc()
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid api key"}}`, http.StatusUnauthorized)
					return
				}
				if !key.IsActive {
					metrics.AuthAttemptsTotal.WithLabelValues("api_key", "disabled").Inc()
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"api key is disabled"}}`, http.StatusUnauthorized)
					return
				}
				if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
					metrics.AuthAttemptsTotal.WithLabelValues("api_key", "expired").Inc()
					http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"api key has expired"}}`, http.StatusUnauthorized)
					return
				}

				// Touch last_used_at in background
				go func() { _ = akRepo.TouchLastUsed(context.Background(), key.ID) }()

				// Resolve user role from the user table (API key inherits user's role)
				ctx := context.WithValue(r.Context(), UserIDKey, key.UserID)
				ctx = context.WithValue(ctx, RoleKey, "user") // default; admin check happens via user lookup in RBAC if needed
				ctx = context.WithValue(ctx, AuthMethod, "api_key")
				metrics.AuthAttemptsTotal.WithLabelValues("api_key", "success").Inc()
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Fall back to Bearer JWT
			header := r.Header.Get("Authorization")
			if header == "" {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"missing authorization header"}}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid authorization format"}}`, http.StatusUnauthorized)
				return
			}

			claims, err := authSvc.ValidateToken(parts[1])
			if err != nil {
				metrics.AuthAttemptsTotal.WithLabelValues("jwt", "invalid").Inc()
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid or expired token"}}`, http.StatusUnauthorized)
				return
			}

			if claims.TokenType != "access" {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"expected access token"}}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			ctx = context.WithValue(ctx, AuthMethod, "jwt")
			metrics.AuthAttemptsTotal.WithLabelValues("jwt", "success").Inc()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts the user ID from request context.
func GetUserID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(UserIDKey).(uuid.UUID)
	return id
}

// GetRole extracts the user role from request context.
func GetRole(ctx context.Context) string {
	role, _ := ctx.Value(RoleKey).(string)
	return role
}
