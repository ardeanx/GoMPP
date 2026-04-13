package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

type ApiKeyHandler struct {
	repo *repository.ApiKeyRepository
}

func NewApiKeyHandler(repo *repository.ApiKeyRepository) *ApiKeyHandler {
	return &ApiKeyHandler{repo: repo}
}

func (h *ApiKeyHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	keys, err := h.repo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list api keys")
		return
	}
	if keys == nil {
		keys = []model.ApiKey{}
	}
	writeJSON(w, http.StatusOK, keys)
}

func (h *ApiKeyHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateApiKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
		return
	}

	// Generate a cryptographically random API key
	plainKey, keyHash, keyPrefix := generateApiKey()

	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "expires_at must be RFC3339 format")
			return
		}
		expiresAt = &t
	}

	scopes := req.Scopes
	if scopes == nil {
		scopes = []string{}
	}

	apiKey := &model.ApiKey{
		UserID:    userID,
		Name:      req.Name,
		KeyHash:   keyHash,
		KeyPrefix: keyPrefix,
		Scopes:    scopes,
		ExpiresAt: expiresAt,
	}

	if err := h.repo.Create(r.Context(), apiKey); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create api key")
		return
	}

	writeJSON(w, http.StatusCreated, model.CreateApiKeyResponse{
		ApiKey:   *apiKey,
		PlainKey: plainKey,
	})
}

func (h *ApiKeyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid api key id")
		return
	}

	key, err := h.repo.GetByID(r.Context(), id)
	if err != nil || key == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "api key not found")
		return
	}

	// Users can only delete their own keys
	if key.UserID != userID {
		role := middleware.GetRole(r.Context())
		if role != "admin" {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "cannot delete another user's api key")
			return
		}
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete api key")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ApiKeyHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid api key id")
		return
	}

	key, err := h.repo.GetByID(r.Context(), id)
	if err != nil || key == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "api key not found")
		return
	}
	if key.UserID != userID {
		role := middleware.GetRole(r.Context())
		if role != "admin" {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "cannot update another user's api key")
			return
		}
	}

	var req model.UpdateApiKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.Name != nil {
		key.Name = *req.Name
	}
	if req.Scopes != nil {
		key.Scopes = req.Scopes
	}
	if req.IsActive != nil {
		key.IsActive = *req.IsActive
	}

	if err := h.repo.Update(r.Context(), key); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update api key")
		return
	}

	writeJSON(w, http.StatusOK, key)
}

// generateApiKey returns (plainKey, sha256Hash, prefix)
func generateApiKey() (string, string, string) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	plain := "gmpp_" + hex.EncodeToString(b)
	hash := sha256.Sum256([]byte(plain))
	return plain, hex.EncodeToString(hash[:]), plain[:8]
}
