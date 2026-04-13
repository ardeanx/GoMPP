package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
)

// ProfileHandler handles avatar upload, Google account linking, and passkey management.
type ProfileHandler struct {
	userRepo    *repository.UserRepository
	credRepo    *repository.CredentialRepository
	store       storage.Backend
	googleSvc   *service.GoogleService
	webauthnSvc *service.WebAuthnService
}

func NewProfileHandler(
	userRepo *repository.UserRepository,
	credRepo *repository.CredentialRepository,
	store storage.Backend,
	googleSvc *service.GoogleService,
	webauthnSvc *service.WebAuthnService,
) *ProfileHandler {
	return &ProfileHandler{
		userRepo:    userRepo,
		credRepo:    credRepo,
		store:       store,
		googleSvc:   googleSvc,
		webauthnSvc: webauthnSvc,
	}
}

// Avatar

const maxAvatarSize = 5 << 20 // 5 MB

var allowedAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// UploadAvatar handles multipart avatar upload.
func (h *ProfileHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	if err := r.ParseMultipartForm(maxAvatarSize); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "file too large or invalid multipart form")
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "avatar file is required")
		return
	}
	defer file.Close()

	if header.Size > maxAvatarSize {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "avatar must be under 5 MB")
		return
	}

	ct := header.Header.Get("Content-Type")
	ext, ok := allowedAvatarTypes[ct]
	if !ok {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "avatar must be JPEG, PNG, or WebP")
		return
	}

	storagePath := fmt.Sprintf("avatars/%s%s", userID.String(), ext)

	if err := h.store.Put(storagePath, file); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to store avatar")
		return
	}

	avatarURL := h.store.URL(storagePath)
	if err := h.userRepo.UpdateAvatar(r.Context(), userID, avatarURL); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update avatar")
		return
	}

	// Clean up old avatars with different extensions
	for _, otherExt := range allowedAvatarTypes {
		if otherExt != ext {
			oldPath := fmt.Sprintf("avatars/%s%s", userID.String(), otherExt)
			_ = h.store.Delete(oldPath)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"avatar_url": avatarURL})
}

// DeleteAvatar removes the user's avatar.
func (h *ProfileHandler) DeleteAvatar(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	for _, ext := range allowedAvatarTypes {
		storagePath := fmt.Sprintf("avatars/%s%s", userID.String(), ext)
		_ = h.store.Delete(storagePath)
	}

	if err := h.userRepo.UpdateAvatar(r.Context(), userID, ""); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to clear avatar")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ServeAvatar serves an avatar image by user ID (public).
func (h *ProfileHandler) ServeAvatar(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "*")
	if filename == "" {
		http.NotFound(w, r)
		return
	}

	storagePath := path.Join("avatars", filename)

	exists, err := h.store.Exists(storagePath)
	if err != nil || !exists {
		http.NotFound(w, r)
		return
	}

	reader, err := h.store.Get(storagePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer reader.Close()

	// Set content type based on extension
	ext := strings.ToLower(path.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")

	io.Copy(w, reader)
}

// Google Account Linking
// LinkGoogle links a Google account to the authenticated user.
func (h *ProfileHandler) LinkGoogle(w http.ResponseWriter, r *http.Request) {
	if !h.googleSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "google sign-in is not configured")
		return
	}

	userID := middleware.GetUserID(r.Context())

	var body struct {
		Credential string `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Credential == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "credential is required")
		return
	}

	gUser, err := h.googleSvc.VerifyAccessToken(r.Context(), body.Credential)
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid Google credential")
		return
	}

	// Check if this Google account is already linked to another user
	existing, err := h.userRepo.GetByGoogleID(r.Context(), gUser.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check Google link")
		return
	}
	if existing != nil && existing.ID != userID {
		writeError(w, http.StatusConflict, "CONFLICT", "this Google account is linked to another user")
		return
	}

	if err := h.userRepo.SetGoogleID(r.Context(), userID, gUser.Sub); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to link Google account")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"linked": true})
}

// UnlinkGoogle removes the Google account link from the authenticated user.
func (h *ProfileHandler) UnlinkGoogle(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	if err := h.userRepo.ClearGoogleID(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to unlink Google account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Passkey (WebAuthn) Management
// ListPasskeys returns the authenticated user's registered passkeys.
func (h *ProfileHandler) ListPasskeys(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	creds, err := h.credRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list passkeys")
		return
	}
	if creds == nil {
		creds = []model.WebAuthnCredential{}
	}
	writeJSON(w, http.StatusOK, creds)
}

// BeginRegisterPasskey starts the WebAuthn registration ceremony.
func (h *ProfileHandler) BeginRegisterPasskey(w http.ResponseWriter, r *http.Request) {
	if !h.webauthnSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "passkeys are not configured")
		return
	}

	userID := middleware.GetUserID(r.Context())

	user, err := h.userRepo.GetByID(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}

	existingCreds, err := h.credRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list credentials")
		return
	}

	options, sessionToken, err := h.webauthnSvc.BeginRegistration(user, existingCreds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to begin passkey registration")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"options": options,
		"session": sessionToken,
	})
}

// FinishRegisterPasskey completes the WebAuthn registration ceremony.
func (h *ProfileHandler) FinishRegisterPasskey(w http.ResponseWriter, r *http.Request) {
	if !h.webauthnSvc.Enabled() {
		writeError(w, http.StatusBadRequest, "FEATURE_DISABLED", "passkeys are not configured")
		return
	}

	userID := middleware.GetUserID(r.Context())

	var body struct {
		Session    string          `json:"session"`
		Name       string          `json:"name"`
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

	user, err := h.userRepo.GetByID(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
		return
	}

	existingCreds, err := h.credRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list credentials")
		return
	}

	// Parse the credential from the request body
	parsed, err := protocol.ParseCredentialCreationResponseBody(strings.NewReader(string(body.Credential)))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid credential data: "+err.Error())
		return
	}

	cred, err := h.webauthnSvc.FinishRegistration(user, existingCreds, body.Session, parsed)
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "passkey registration failed: "+err.Error())
		return
	}

	if body.Name != "" {
		cred.Name = body.Name
	} else {
		cred.Name = "Passkey"
	}

	if err := h.credRepo.Create(r.Context(), cred); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save passkey")
		return
	}

	writeJSON(w, http.StatusCreated, cred)
}

// RenamePasskey
func (h *ProfileHandler) RenamePasskey(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid passkey ID")
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
		return
	}

	if err := h.credRepo.Rename(r.Context(), id, userID, body.Name); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to rename passkey")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeletePasskey removes a passkey.
func (h *ProfileHandler) DeletePasskey(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid passkey ID")
		return
	}

	if err := h.credRepo.Delete(r.Context(), id, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete passkey")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
