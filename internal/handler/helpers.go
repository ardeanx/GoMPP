package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// emailRe is a simple, intentionally permissive email regex (RFC 5322 simplified).
var emailRe = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// usernameRe allows alphanumeric, underscore, hyphen — 3-30 characters.
var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_\-]{3,30}$`)

func isValidEmail(email string) bool {
	return len(email) <= 254 && emailRe.MatchString(email)
}

func isValidUsername(username string) bool {
	return usernameRe.MatchString(username)
}

func isValidWebhookURL(raw string) bool {
	if len(raw) > 2048 {
		return false
	}
	u, err := url.ParseRequestURI(raw)
	if err != nil {
		return false
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && !strings.HasPrefix(u.Host, "localhost") && !strings.HasPrefix(u.Host, "127.") && !strings.HasPrefix(u.Host, "10.") && !strings.HasPrefix(u.Host, "192.168.")
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"data": data})
}

func writeJSONList(w http.ResponseWriter, data any, page, perPage, total int) {
	totalPages := total / perPage
	if total%perPage != 0 {
		totalPages++
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"data": data,
		"meta": map[string]any{
			"page":        page,
			"per_page":    perPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}

func parseIntQuery(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 1 {
		return defaultVal
	}
	return v
}
