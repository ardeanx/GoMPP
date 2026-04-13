package middleware

import (
	"net/http"
	"strings"
)

// SecureHeaders adds security-related HTTP headers to every response.
func SecureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-XSS-Protection", "0")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		next.ServeHTTP(w, r)
	})
}

// MaxBodySize limits the request body to the given number of bytes.
// Multipart/form-data requests (file uploads) are exempt from this limit.
// Use 0 to skip the limit entirely.
func MaxBodySize(bytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil && bytes > 0 {
				ct := r.Header.Get("Content-Type")
				if !strings.HasPrefix(ct, "multipart/form-data") {
					r.Body = http.MaxBytesReader(w, r.Body, bytes)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
