package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
)

type UserHandler struct {
	repo    *repository.UserRepository
	authSvc *service.AuthService
}

func NewUserHandler(repo *repository.UserRepository, authSvc *service.AuthService) *UserHandler {
	return &UserHandler{repo: repo, authSvc: authSvc}
}

// List returns paginated users (admin only).
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	page := parseIntQuery(r, "page", 1)
	perPage := parseIntQuery(r, "per_page", 20)
	if perPage > 100 {
		perPage = 100
	}

	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")
	var isActive *bool
	isActiveParam := r.URL.Query().Get("is_active")
	statusParam := r.URL.Query().Get("status")
	if isActiveParam == "true" || statusParam == "active" {
		v := true
		isActive = &v
	} else if isActiveParam == "false" || statusParam == "inactive" {
		v := false
		isActive = &v
	}

	users, total, err := h.repo.List(r.Context(), page, perPage, search, role, isActive)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list users")
		return
	}
	if users == nil {
		users = []model.User{}
	}
	writeJSONList(w, users, page, perPage, total)
}

// Get returns a single user
func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user ID")
		return
	}

	callerRole := middleware.GetRole(r.Context())
	callerID := middleware.GetUserID(r.Context())
	if callerRole != "admin" && id != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	user, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get user")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// Update modifies a user profile
func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user ID")
		return
	}

	callerRole := middleware.GetRole(r.Context())
	callerID := middleware.GetUserID(r.Context())
	if callerRole != "admin" && id != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	user, err := h.repo.GetByID(r.Context(), id)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}

	var req model.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.Username != nil {
		user.Username = *req.Username
	}
	if req.Email != nil {
		user.Email = *req.Email
	}
	// Only admin can change role or active status
	if callerRole == "admin" {
		if req.Role != nil {
			user.Role = *req.Role
		}
		if req.IsActive != nil {
			user.IsActive = *req.IsActive
		}
	}

	if err := h.repo.Update(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// ChangePassword changes a user's password
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user ID")
		return
	}

	callerRole := middleware.GetRole(r.Context())
	callerID := middleware.GetUserID(r.Context())
	if callerRole != "admin" && id != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	var req model.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.NewPassword == "" || len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 8 characters")
		return
	}

	hash, err := h.authSvc.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
		return
	}

	if err := h.repo.UpdatePassword(r.Context(), id, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to change password")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Delete deactivates a user account.
func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user ID")
		return
	}
	if err := h.repo.Deactivate(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to deactivate user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Create new user account
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Email == "" || req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "email, username, and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 8 characters")
		return
	}

	role := req.Role
	if role == "" {
		role = "user"
	}
	validRoles := map[string]bool{"super_admin": true, "admin": true, "staff": true, "user": true}
	if !validRoles[role] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid role")
		return
	}

	hash, err := h.authSvc.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
		return
	}

	user := &model.User{
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: hash,
		Role:         role,
	}
	if err := h.repo.Create(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create user")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}
