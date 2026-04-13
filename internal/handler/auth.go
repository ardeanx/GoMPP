package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
)

type AuthHandler struct {
	authSvc     *service.AuthService
	userRepo    *repository.UserRepository
	credRepo    *repository.CredentialRepository
	googleSvc   *service.GoogleService
	webauthnSvc *service.WebAuthnService
}

func NewAuthHandler(
	authSvc *service.AuthService,
	userRepo *repository.UserRepository,
	credRepo *repository.CredentialRepository,
	googleSvc *service.GoogleService,
	webauthnSvc *service.WebAuthnService,
) *AuthHandler {
	return &AuthHandler{
		authSvc:     authSvc,
		userRepo:    userRepo,
		credRepo:    credRepo,
		googleSvc:   googleSvc,
		webauthnSvc: webauthnSvc,
	}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req model.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Email == "" || req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "email, username, and password are required")
		return
	}
	if !isValidEmail(req.Email) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid email format")
		return
	}
	if !isValidUsername(req.Username) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "username must be 3-30 characters (alphanumeric, underscore, hyphen)")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 8 characters")
		return
	}

	user, err := h.authSvc.Register(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrUserExists) {
			writeError(w, http.StatusConflict, "CONFLICT", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to register user")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "email and password are required")
		return
	}

	resp, err := h.authSvc.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) || errors.Is(err, service.ErrAccountDisabled) {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to login")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req model.RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "refresh_token is required")
		return
	}

	resp, err := h.authSvc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or expired refresh token")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.userRepo.GetByID(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// GoogleLogin authenticates or creates a user via a Google ID token.
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if !h.googleSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "google sign-in is not configured")
		return
	}

	var body struct {
		Credential string `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Credential == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "credential is required")
		return
	}

	gUser, err := h.googleSvc.VerifyAccessToken(r.Context(), body.Credential)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid Google credential")
		return
	}

	// Try to find user by Google ID first
	user, err := h.userRepo.GetByGoogleID(r.Context(), gUser.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to lookup user")
		return
	}

	if user == nil {
		// Try by email
		user, err = h.userRepo.GetByEmail(r.Context(), gUser.Email)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to lookup user")
			return
		}

		if user == nil {
			// Create new user
			username := strings.Split(gUser.Email, "@")[0]
			user = &model.User{
				Email:    gUser.Email,
				Username: username,
				Role:     "user",
			}
			if err := h.userRepo.Create(r.Context(), user); err != nil {
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create user")
				return
			}
		}

		// Link Google ID
		if err := h.userRepo.SetGoogleID(r.Context(), user.ID, gUser.Sub); err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to link Google account")
			return
		}

		// Re-fetch to get updated fields
		user, _ = h.userRepo.GetByID(r.Context(), user.ID)
	}

	resp, err := h.authSvc.IssueTokens(r.Context(), user)
	if err != nil {
		if errors.Is(err, service.ErrAccountDisabled) {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to issue tokens")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// PasskeyBeginLogin starts a discoverable WebAuthn login ceremony.
func (h *AuthHandler) PasskeyBeginLogin(w http.ResponseWriter, r *http.Request) {
	if !h.webauthnSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "passkeys are not configured")
		return
	}

	options, sessionToken, err := h.webauthnSvc.BeginDiscoverableLogin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to begin passkey login")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"options": options,
		"session": sessionToken,
	})
}

// PasskeyFinishLogin completes a discoverable WebAuthn login ceremony.
func (h *AuthHandler) PasskeyFinishLogin(w http.ResponseWriter, r *http.Request) {
	if !h.webauthnSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "passkeys are not configured")
		return
	}

	var body struct {
		Session    string          `json:"session"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if body.Session == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "session is required")
		return
	}

	parsed, err := protocol.ParseCredentialRequestResponseBody(strings.NewReader(string(body.Credential)))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid credential data")
		return
	}

	discoverUser := func(rawID, userHandle []byte) (*model.User, []model.WebAuthnCredential, error) {
		uid, err := uuid.FromBytes(userHandle)
		if err != nil {
			return nil, nil, err
		}
		user, err := h.userRepo.GetByID(r.Context(), uid)
		if err != nil || user == nil {
			return nil, nil, errors.New("user not found")
		}
		creds, err := h.credRepo.ListByUser(r.Context(), uid)
		if err != nil {
			return nil, nil, err
		}
		return user, creds, nil
	}

	user, cred, err := h.webauthnSvc.FinishDiscoverableLogin(body.Session, parsed, discoverUser)
	if err != nil {
		log.Error().Err(err).Msg("passkey verification failed")
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "passkey verification failed")
		return
	}

	// Update sign count
	_ = h.credRepo.UpdateSignCount(r.Context(), cred.ID, cred.Authenticator.SignCount)

	resp, err := h.authSvc.IssueTokens(r.Context(), user)
	if err != nil {
		if errors.Is(err, service.ErrAccountDisabled) {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to issue tokens")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// AuthProviders returns which auth providers are enabled.
func (h *AuthHandler) AuthProviders(w http.ResponseWriter, r *http.Request) {
	providers := map[string]any{
		"google":  h.googleSvc.Enabled(),
		"passkey": h.webauthnSvc.Enabled(),
	}
	if h.googleSvc.Enabled() {
		providers["google_client_id"] = h.googleSvc.ClientID()
	}
	writeJSON(w, http.StatusOK, providers)
}
