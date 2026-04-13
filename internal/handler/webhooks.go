package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

type WebhookHandler struct {
	repo *repository.WebhookRepository
}

func NewWebhookHandler(repo *repository.WebhookRepository) *WebhookHandler {
	return &WebhookHandler{repo: repo}
}

func (h *WebhookHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())

	page := parseIntQuery(r, "page", 1)
	perPage := parseIntQuery(r, "per_page", 20)
	if perPage > 100 {
		perPage = 100
	}

	var webhooks []model.Webhook
	var err error
	if role == "admin" {
		// Admin can see all — pass uuid.Nil and filter in repo if needed; for now list by user.
		webhooks, err = h.repo.ListByUser(r.Context(), userID)
	} else {
		webhooks, err = h.repo.ListByUser(r.Context(), userID)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list webhooks")
		return
	}
	if webhooks == nil {
		webhooks = []model.Webhook{}
	}

	total := len(webhooks)

	// Simple in-memory pagination
	start := (page - 1) * perPage
	end := start + perPage
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	writeJSONList(w, webhooks[start:end], page, perPage, total)
}

func (h *WebhookHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid webhook ID")
		return
	}

	wh, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get webhook")
		return
	}
	if wh == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "webhook not found")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())
	if role != "admin" && wh.UserID != userID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}
	writeJSON(w, http.StatusOK, wh)
}

func (h *WebhookHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "url is required")
		return
	}
	if !isValidWebhookURL(req.URL) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "url must be a valid public HTTP(S) URL")
		return
	}
	if len(req.Events) == 0 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "at least one event is required")
		return
	}

	secret, err := generateWebhookSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate secret")
		return
	}

	wh := &model.Webhook{
		UserID:   middleware.GetUserID(r.Context()),
		Name:     req.Name,
		URL:      req.URL,
		Secret:   secret,
		Events:   req.Events,
		IsActive: true,
	}

	if err := h.repo.Create(r.Context(), wh); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create webhook")
		return
	}
	// Return secret on creation (Secret has json:"-" on the model)
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":         wh.ID,
		"user_id":    wh.UserID,
		"name":       wh.Name,
		"url":        wh.URL,
		"secret":     secret,
		"events":     wh.Events,
		"is_active":  wh.IsActive,
		"created_at": wh.CreatedAt,
		"updated_at": wh.UpdatedAt,
	})
}

func (h *WebhookHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid webhook ID")
		return
	}

	wh, err := h.repo.GetByID(r.Context(), id)
	if err != nil || wh == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "webhook not found")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())
	if role != "admin" && wh.UserID != userID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	var req model.UpdateWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.Name != nil {
		wh.Name = *req.Name
	}
	if req.URL != nil {
		wh.URL = *req.URL
	}
	if req.Events != nil {
		wh.Events = req.Events
	}
	if req.IsActive != nil {
		wh.IsActive = *req.IsActive
	}

	if err := h.repo.Update(r.Context(), wh); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update webhook")
		return
	}
	writeJSON(w, http.StatusOK, wh)
}

func (h *WebhookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid webhook ID")
		return
	}

	wh, err := h.repo.GetByID(r.Context(), id)
	if err != nil || wh == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "webhook not found")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())
	if role != "admin" && wh.UserID != userID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete webhook")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *WebhookHandler) RegenerateSecret(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid webhook ID")
		return
	}

	wh, err := h.repo.GetByID(r.Context(), id)
	if err != nil || wh == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "webhook not found")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())
	if role != "admin" && wh.UserID != userID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	secret, err := generateWebhookSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate secret")
		return
	}

	if err := h.repo.UpdateSecret(r.Context(), id, secret); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update secret")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"secret": secret})
}

func (h *WebhookHandler) GetDeliveries(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid webhook ID")
		return
	}

	wh, err := h.repo.GetByID(r.Context(), id)
	if err != nil || wh == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "webhook not found")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())
	if role != "admin" && wh.UserID != userID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	// For now return empty — deliveries are logged asynchronously
	writeJSON(w, http.StatusOK, []interface{}{})
}

func generateWebhookSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "whsec_" + hex.EncodeToString(b), nil
}
