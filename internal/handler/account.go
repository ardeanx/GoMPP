package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

type AccountHandler struct {
	sessionRepo *repository.AccountSessionRepository
}

func NewAccountHandler(sessionRepo *repository.AccountSessionRepository) *AccountHandler {
	return &AccountHandler{sessionRepo: sessionRepo}
}

// ListSessions returns the authenticated user's account sessions (paginated).
func (h *AccountHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	page := parseIntQuery(r, "page", 1)
	perPage := parseIntQuery(r, "per_page", 10)
	if perPage > 100 {
		perPage = 100
	}

	sessions, total, err := h.sessionRepo.List(r.Context(), userID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list sessions")
		return
	}
	if sessions == nil {
		sessions = []model.AccountSession{}
	}
	writeJSONList(w, sessions, page, perPage, total)
}

// CreateSession adds a new session device entry for the authenticated user.
func (h *AccountHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req struct {
		DeviceName string  `json:"device_name"`
		DeviceOS   string  `json:"device_os"`
		Browser    string  `json:"browser"`
		IPAddress  *string `json:"ip_address,omitempty"`
		Location   string  `json:"location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.DeviceName == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "device_name is required")
		return
	}

	session := &model.AccountSession{
		UserID:     userID,
		DeviceName: req.DeviceName,
		DeviceOS:   req.DeviceOS,
		Browser:    req.Browser,
		IPAddress:  req.IPAddress,
		Location:   req.Location,
	}
	session.LastSessionAt = session.CreatedAt

	if err := h.sessionRepo.Create(r.Context(), session); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create session")
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

// DeleteSession removes a session device entry for the authenticated user.
func (h *AccountHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid session ID")
		return
	}

	// Verify ownership
	session, err := h.sessionRepo.GetByID(r.Context(), sessionID)
	if err != nil || session == nil || session.UserID != userID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "session not found")
		return
	}

	if err := h.sessionRepo.Delete(r.Context(), sessionID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
