package handler

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsHandler struct {
	db *pgxpool.Pool
}

func NewSettingsHandler(db *pgxpool.Pool) *SettingsHandler {
	return &SettingsHandler{db: db}
}

type settingEntry struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	Description *string     `json:"description,omitempty"`
	UpdatedAt   *time.Time  `json:"updated_at,omitempty"`
}

func (h *SettingsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(),
		`SELECT key, value, description FROM system_settings ORDER BY key`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query settings")
		return
	}
	defer rows.Close()

	settings := []settingEntry{}
	for rows.Next() {
		var s settingEntry
		var rawVal []byte
		if err := rows.Scan(&s.Key, &rawVal, &s.Description); err != nil {
			continue
		}
		_ = json.Unmarshal(rawVal, &s.Value)
		settings = append(settings, s)
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *SettingsHandler) GetByKey(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "key is required")
		return
	}

	var s settingEntry
	var rawVal []byte
	err := h.db.QueryRow(r.Context(),
		`SELECT key, value, description FROM system_settings WHERE key = $1`, key).
		Scan(&s.Key, &rawVal, &s.Description)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "setting not found")
		return
	}
	_ = json.Unmarshal(rawVal, &s.Value)
	writeJSON(w, http.StatusOK, s)
}

func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "key is required")
		return
	}

	var body struct {
		Value interface{} `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	valJSON, err := json.Marshal(body.Value)
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid value")
		return
	}

	tag, err := h.db.Exec(r.Context(),
		`INSERT INTO system_settings (key, value) VALUES ($1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, key, valJSON)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update setting")
		return
	}
	_ = tag

	var s settingEntry
	s.Key = key
	s.Value = body.Value
	now := time.Now()
	s.UpdatedAt = &now
	writeJSON(w, http.StatusOK, s)
}

func (h *SettingsHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Settings []struct {
			Key   string      `json:"key"`
			Value interface{} `json:"value"`
		} `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	updated := 0
	for _, s := range body.Settings {
		valJSON, err := json.Marshal(s.Value)
		if err != nil {
			continue
		}
		_, err = h.db.Exec(r.Context(),
			`INSERT INTO system_settings (key, value) VALUES ($1, $2)
			 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, s.Key, valJSON)
		if err == nil {
			updated++
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": updated})
}

// VerifyFFmpeg checks whether the given FFmpeg binary path is valid and returns its version.
func (h *SettingsHandler) VerifyFFmpeg(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if body.Path == "" {
		body.Path = "ffmpeg"
	}

	out, err := exec.CommandContext(r.Context(), body.Path, "-version").Output()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"valid":   false,
			"error":   "ffmpeg not found or not executable at the given path",
			"version": "",
		})
		return
	}

	version := ""
	lines := strings.SplitN(string(out), "\n", 2)
	if len(lines) > 0 {
		version = strings.TrimSpace(lines[0])
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"valid":   true,
		"error":   "",
		"version": version,
	})
}
