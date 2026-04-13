package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
)

type VideoHandler struct {
	videoSvc  *service.VideoService
	videoRepo *repository.VideoRepository
	storage   storage.Backend
}

func NewVideoHandler(videoSvc *service.VideoService, videoRepo *repository.VideoRepository, store storage.Backend) *VideoHandler {
	return &VideoHandler{videoSvc: videoSvc, videoRepo: videoRepo, storage: store}
}

func (h *VideoHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32 MB memory; excess spills to disk
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "file is required")
		return
	}
	defer file.Close()

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "video/mp4"
	}

	title := r.FormValue("title")
	if title == "" {
		title = header.Filename
	}

	video, err := h.videoSvc.Upload(r.Context(), userID, title, mimeType, header.Size, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to upload video")
		return
	}
	writeJSON(w, http.StatusCreated, video)
}

func (h *VideoHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	role := middleware.GetRole(r.Context())

	params := model.VideoListParams{
		Page:    parseIntQuery(r, "page", 1),
		PerPage: parseIntQuery(r, "per_page", 20),
		Status:  r.URL.Query().Get("status"),
		Search:  r.URL.Query().Get("search"),
		Sort:    r.URL.Query().Get("sort"),
		Order:   r.URL.Query().Get("order"),
	}

	// Non-admin users only see their own videos
	if role != "admin" {
		params.UserID = &userID
	}

	videos, total, err := h.videoSvc.List(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list videos")
		return
	}
	if videos == nil {
		videos = []model.Video{}
	}
	writeJSONList(w, videos, params.Page, params.PerPage, total)
}

func (h *VideoHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	video, err := h.videoSvc.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get video")
		return
	}
	if video == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	// Ownership check
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && video.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	// Include transcode jobs
	jobs, _ := h.videoSvc.GetJobs(r.Context(), id)

	// Compute stream URL (may be signed if preset requires it)
	streamURL := h.videoSvc.StreamURL(r.Context(), video)

	writeJSON(w, http.StatusOK, map[string]any{
		"video":      video,
		"jobs":       jobs,
		"stream_url": streamURL,
	})
}

func (h *VideoHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	// Ownership check: fetch first
	existing, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || existing == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && existing.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	var req model.UpdateVideoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	video, err := h.videoSvc.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update video")
		return
	}
	writeJSON(w, http.StatusOK, video)
}

func (h *VideoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	// Ownership check
	existing, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || existing == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && existing.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	if err := h.videoSvc.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete video")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *VideoHandler) Retranscode(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	// Ownership check
	existing, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || existing == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && existing.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	var req model.RetranscodeRequest
	_ = json.NewDecoder(r.Body).Decode(&req) // optional body

	jobIDs, err := h.videoSvc.Retranscode(r.Context(), id, req.PresetIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to retranscode video")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{
		"jobs_created": len(jobIDs),
		"job_ids":      jobIDs,
	})
}

// ListThumbnails returns the list of auto-generated thumbnail candidates for a video.
func (h *VideoHandler) ListThumbnails(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	video, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || video == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	// Thumbnail candidates are stored under transcoded/{hash}_{uuid}/thumbnail/
	dir := service.VideoOutputDir(video)
	thumbDir := dir + "/thumbnail"

	files, err := h.storage.List(thumbDir)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"thumbnails": []string{}})
		return
	}

	// Filter to only image files
	var thumbs []string
	for _, f := range files {
		ext := strings.ToLower(filepath.Ext(f))
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
			thumbs = append(thumbs, f)
		}
	}
	if thumbs == nil {
		thumbs = []string{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"thumbnails": thumbs,
		"current":    video.ThumbnailPath,
	})
}

// SetThumbnail sets the active thumbnail for a video from the available candidates.
func (h *VideoHandler) SetThumbnail(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	video, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || video == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	// Ownership check
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && video.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Path == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "path is required")
		return
	}

	// Validate the path is a real file in storage
	exists, err := h.storage.Exists(req.Path)
	if err != nil || !exists {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "thumbnail file not found")
		return
	}

	if err := h.videoRepo.SetThumbnail(r.Context(), id, req.Path); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set thumbnail")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"thumbnail_path": req.Path})
}

// UploadThumbnail allows uploading a custom thumbnail for a video.
func (h *VideoHandler) UploadThumbnail(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	video, err := h.videoSvc.Get(r.Context(), id)
	if err != nil || video == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	// Ownership check
	callerID := middleware.GetUserID(r.Context())
	if middleware.GetRole(r.Context()) != "admin" && video.UserID != callerID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "access denied")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB max
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "file is required")
		return
	}
	defer file.Close()

	// Validate content type
	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "file must be an image")
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}

	dir := service.VideoOutputDir(video)
	thumbPath := fmt.Sprintf("%s/thumbnail/custom%s", dir, ext)

	if err := h.storage.Put(thumbPath, file); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to upload thumbnail")
		return
	}

	if err := h.videoRepo.SetThumbnail(r.Context(), id, thumbPath); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set thumbnail")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"thumbnail_path": thumbPath})
}

// GetPublic serves public video info by slug
func (h *VideoHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "slug is required")
		return
	}

	video, err := h.videoRepo.GetBySlug(r.Context(), slug)
	if err != nil || video == nil || video.Status != model.VideoStatusReady {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	// Increment view count
	_ = h.videoRepo.IncrementViewCount(r.Context(), video.ID)

	// Compute stream URL
	streamURL := h.videoSvc.StreamURL(r.Context(), video)

	// Return public-safe fields only
	writeJSON(w, http.StatusOK, map[string]any{
		"video": map[string]any{
			"id":             video.ID,
			"title":          video.Title,
			"slug":           video.Slug,
			"description":    video.Description,
			"duration":       video.Duration,
			"width":          video.Width,
			"height":         video.Height,
			"thumbnail_path": video.ThumbnailPath,
			"view_count":     video.ViewCount,
			"allow_download": video.AllowDownload,
			"created_at":     video.CreatedAt,
		},
		"stream_url": streamURL,
		"embed_url":  fmt.Sprintf("/embed/%s", video.ID),
	})
}

// GetPublicDownload serves the source file download for public videos with allow_download enabled.
func (h *VideoHandler) GetPublicDownload(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "slug is required")
		return
	}

	video, err := h.videoRepo.GetBySlug(r.Context(), slug)
	if err != nil || video == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "video not found")
		return
	}

	if video.Status != model.VideoStatusReady || !video.AllowDownload {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "download not available")
		return
	}

	rc, err := h.storage.Get(video.SourcePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get file")
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, video.OriginalFilename))
	io.Copy(w, rc)
}
