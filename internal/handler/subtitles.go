package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/storage"
)

const openSubtitlesBaseURL = "https://api.opensubtitles.com/api/v1"

// SubtitlesHandler proxies requests to the OpenSubtitles API and manages
// subtitle tracks attached to videos.
type SubtitlesHandler struct {
	db           *pgxpool.Pool
	client       *http.Client
	subtitleRepo *repository.SubtitleRepository
	store        storage.Backend
}

func NewSubtitlesHandler(db *pgxpool.Pool, subtitleRepo *repository.SubtitleRepository, store storage.Backend) *SubtitlesHandler {
	return &SubtitlesHandler{
		db:           db,
		client:       &http.Client{Timeout: 30 * time.Second},
		subtitleRepo: subtitleRepo,
		store:        store,
	}
}

// getAPIKey reads the opensubtitles_api_key from system_settings.
func (h *SubtitlesHandler) getAPIKey(r *http.Request) (string, error) {
	var raw []byte
	err := h.db.QueryRow(r.Context(),
		`SELECT value FROM system_settings WHERE key = 'opensubtitles_api_key'`).Scan(&raw)
	if err != nil {
		return "", fmt.Errorf("api key not configured")
	}
	var key string
	if err := json.Unmarshal(raw, &key); err != nil {
		return "", fmt.Errorf("invalid api key format")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", fmt.Errorf("api key is empty")
	}
	return key, nil
}

// Search searches for subtitles on OpenSubtitles.
// GET /api/v1/subtitles/search?query=...&languages=...&imdb_id=...
func (h *SubtitlesHandler) Search(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.getAPIKey(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SUBTITLES_NOT_CONFIGURED", err.Error())
		return
	}

	// Forward query parameters
	params := url.Values{}
	for _, key := range []string{"query", "languages", "imdb_id", "tmdb_id", "type", "season_number", "episode_number", "year", "page"} {
		if v := r.URL.Query().Get(key); v != "" {
			params.Set(key, v)
		}
	}

	if params.Get("query") == "" && params.Get("imdb_id") == "" && params.Get("tmdb_id") == "" {
		writeError(w, http.StatusBadRequest, "MISSING_QUERY", "provide query, imdb_id, or tmdb_id")
		return
	}

	reqURL := openSubtitlesBaseURL + "/subtitles?" + params.Encode()
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, reqURL, nil)
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "gompp v1.0")

	resp, err := h.client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SUBTITLES_REQUEST_FAILED", "failed to contact OpenSubtitles")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// Download fetches a download link for a subtitle file.
func (h *SubtitlesHandler) Download(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.getAPIKey(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SUBTITLES_NOT_CONFIGURED", err.Error())
		return
	}

	// Read and forward the request body
	body, err := io.ReadAll(io.LimitReader(r.Body, 1024))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "failed to read request body")
		return
	}

	// Validate expected JSON
	var payload struct {
		FileID int `json:"file_id"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || payload.FileID == 0 {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "file_id is required")
		return
	}

	reqURL := openSubtitlesBaseURL + "/download"
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, reqURL, strings.NewReader(string(body)))
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "gompp v1.0")

	resp, err := h.client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SUBTITLES_REQUEST_FAILED", "failed to contact OpenSubtitles")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// Languages returns the list of available subtitle languages.
func (h *SubtitlesHandler) Languages(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.getAPIKey(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SUBTITLES_NOT_CONFIGURED", err.Error())
		return
	}

	reqURL := openSubtitlesBaseURL + "/infos/languages"
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, reqURL, nil)
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "gompp v1.0")

	resp, err := h.client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SUBTITLES_REQUEST_FAILED", "failed to contact OpenSubtitles")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// AttachSubtitle downloads a subtitle file from OpenSubtitles and stores it
// locally, then creates a DB record linking it to the video.
func (h *SubtitlesHandler) AttachSubtitle(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video id")
		return
	}

	var payload struct {
		FileID   int    `json:"file_id"`
		Language string `json:"language"`
		Label    string `json:"label"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "invalid JSON body")
		return
	}
	if payload.FileID == 0 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "file_id is required")
		return
	}
	if payload.Language == "" {
		payload.Language = "en"
	}
	if payload.Label == "" {
		payload.Label = payload.Language
	}

	//Get download link from OpenSubtitles
	apiKey, err := h.getAPIKey(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SUBTITLES_NOT_CONFIGURED", err.Error())
		return
	}

	dlBody, _ := json.Marshal(map[string]int{"file_id": payload.FileID})
	dlReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		openSubtitlesBaseURL+"/download", strings.NewReader(string(dlBody)))
	dlReq.Header.Set("Api-Key", apiKey)
	dlReq.Header.Set("Content-Type", "application/json")
	dlReq.Header.Set("User-Agent", "gompp v1.0")

	dlResp, err := h.client.Do(dlReq)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SUBTITLES_REQUEST_FAILED", "failed to contact OpenSubtitles")
		return
	}
	defer dlResp.Body.Close()

	if dlResp.StatusCode != http.StatusOK {
		writeError(w, dlResp.StatusCode, "SUBTITLES_DOWNLOAD_FAILED", "OpenSubtitles returned an error")
		return
	}

	var dlResult struct {
		Link     string `json:"link"`
		FileName string `json:"file_name"`
	}
	if err := json.NewDecoder(io.LimitReader(dlResp.Body, 65536)).Decode(&dlResult); err != nil || dlResult.Link == "" {
		writeError(w, http.StatusBadGateway, "SUBTITLES_DOWNLOAD_FAILED", "invalid download response")
		return
	}

	//Download the actual subtitle file
	fileReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, dlResult.Link, nil)
	fileResp, err := h.client.Do(fileReq)
	if err != nil {
		writeError(w, http.StatusBadGateway, "SUBTITLES_DOWNLOAD_FAILED", "failed to download subtitle file")
		return
	}
	defer fileResp.Body.Close()

	if fileResp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "SUBTITLES_DOWNLOAD_FAILED", "subtitle file download failed")
		return
	}

	// Determine format from filename
	format := "srt"
	if ext := filepath.Ext(dlResult.FileName); ext != "" {
		format = strings.TrimPrefix(strings.ToLower(ext), ".")
	}

	//Store the file
	storagePath := fmt.Sprintf("subtitles/%s/%s_%s.%s", videoID, payload.Language, uuid.New().String()[:8], format)
	if err := h.store.Put(storagePath, io.LimitReader(fileResp.Body, 10<<20)); err != nil {
		writeError(w, http.StatusInternalServerError, "STORAGE_ERROR", "failed to store subtitle file")
		return
	}

	// Create DB record
	sub := &model.VideoSubtitle{
		VideoID:  videoID,
		Language: payload.Language,
		Label:    payload.Label,
		FilePath: storagePath,
		Format:   format,
		Source:   "opensubtitles",
	}
	if err := h.subtitleRepo.Create(r.Context(), sub); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save subtitle record")
		return
	}

	writeJSON(w, http.StatusCreated, sub)
}

// UploadSubtitle handles manual subtitle file upload.
func (h *SubtitlesHandler) UploadSubtitle(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video id")
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

	// Validate extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{".srt": true, ".vtt": true, ".ass": true, ".sub": true, ".ssa": true}
	if !allowedExts[ext] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "unsupported subtitle format; allowed: srt, vtt, ass, sub, ssa")
		return
	}

	language := r.FormValue("language")
	if language == "" {
		language = "en"
	}
	label := r.FormValue("label")
	if label == "" {
		label = language
	}

	format := strings.TrimPrefix(ext, ".")

	// Store the file
	storagePath := fmt.Sprintf("subtitles/%s/%s_%s.%s", videoID, language, uuid.New().String()[:8], format)
	if err := h.store.Put(storagePath, io.LimitReader(file, 10<<20)); err != nil {
		writeError(w, http.StatusInternalServerError, "STORAGE_ERROR", "failed to store subtitle file")
		return
	}

	// Create DB record
	sub := &model.VideoSubtitle{
		VideoID:  videoID,
		Language: language,
		Label:    label,
		FilePath: storagePath,
		Format:   format,
		Source:   "upload",
	}
	if err := h.subtitleRepo.Create(r.Context(), sub); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save subtitle record")
		return
	}

	writeJSON(w, http.StatusCreated, sub)
}

// ListSubtitles returns all subtitle tracks for a video.
func (h *SubtitlesHandler) ListSubtitles(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video id")
		return
	}

	subs, err := h.subtitleRepo.ListByVideoID(r.Context(), videoID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list subtitles")
		return
	}
	if subs == nil {
		subs = []*model.VideoSubtitle{}
	}

	writeJSON(w, http.StatusOK, subs)
}

// DeleteSubtitle removes a subtitle track from a video.
func (h *SubtitlesHandler) DeleteSubtitle(w http.ResponseWriter, r *http.Request) {
	subtitleID, err := uuid.Parse(chi.URLParam(r, "subtitleId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid subtitle id")
		return
	}

	sub, err := h.subtitleRepo.GetByID(r.Context(), subtitleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "subtitle not found")
		return
	}

	// Delete file from storage
	_ = h.store.Delete(sub.FilePath)

	if err := h.subtitleRepo.Delete(r.Context(), subtitleID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete subtitle")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ServeSubtitle serves a subtitle file for playout.
func (h *SubtitlesHandler) ServeSubtitle(w http.ResponseWriter, r *http.Request) {
	subtitleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	sub, err := h.subtitleRepo.GetByID(r.Context(), subtitleID)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	rc, err := h.store.Get(sub.FilePath)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer rc.Close()

	switch sub.Format {
	case "vtt":
		w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
	case "srt":
		w.Header().Set("Content-Type", "text/srt; charset=utf-8")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=86400")

	io.Copy(w, rc)
}

// PublicListSubtitles returns subtitles for public/embed access
func (h *SubtitlesHandler) PublicListSubtitles(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "videoId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video id")
		return
	}

	subs, err := h.subtitleRepo.ListByVideoID(r.Context(), videoID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list subtitles")
		return
	}
	if subs == nil {
		subs = []*model.VideoSubtitle{}
	}

	// Build response with serve URLs
	type subtitleTrack struct {
		ID       uuid.UUID `json:"id"`
		Language string    `json:"language"`
		Label    string    `json:"label"`
		Format   string    `json:"format"`
		URL      string    `json:"url"`
	}
	tracks := make([]subtitleTrack, len(subs))
	for i, s := range subs {
		tracks[i] = subtitleTrack{
			ID:       s.ID,
			Language: s.Language,
			Label:    s.Label,
			Format:   s.Format,
			URL:      fmt.Sprintf("/subtitles/serve/%s", s.ID),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"data": tracks})
}
