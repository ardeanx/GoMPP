package handler

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
)

// MediaHandler serves transcoded media files from storage.
// When a video's preset has signed_url_enabled, requests are validated
// via HMAC-SHA256 signatures and HLS manifests are rewritten with signed URLs.
type MediaHandler struct {
	storage storage.Backend
	db      *pgxpool.Pool
	signer  *service.MediaSigner
}

func NewMediaHandler(store storage.Backend, db *pgxpool.Pool, signer *service.MediaSigner) *MediaHandler {
	return &MediaHandler{storage: store, db: db, signer: signer}
}

// videoIDRegex extracts the UUID portion from the transcoded path:
// transcoded/{hash8}_{uuid}/...
var videoIDRegex = regexp.MustCompile(`^transcoded/[0-9a-f]{8}_([0-9a-f\-]{36})/`)

// presetSecurity holds the signing-relevant fields fetched for a video.
type presetSecurity struct {
	SignedURLEnabled bool
	SignedURLExpiry  int
}

// lookupPresetSecurity finds the preset security settings for a given video ID
// by joining transcode_jobs → presets. Returns nil if lookup fails.
func (h *MediaHandler) lookupPresetSecurity(ctx context.Context, videoID uuid.UUID) *presetSecurity {
	if h.db == nil {
		return nil
	}
	var enabled bool
	var expiry int
	err := h.db.QueryRow(ctx,
		`SELECT COALESCE(p.signed_url_enabled, false), COALESCE(p.signed_url_expiry, 3600)
		 FROM transcode_jobs j
		 JOIN presets p ON p.id = j.preset_id
		 WHERE j.video_id = $1 AND j.status = 'completed'
		 LIMIT 1`, videoID).Scan(&enabled, &expiry)
	if err != nil {
		return nil
	}
	return &presetSecurity{SignedURLEnabled: enabled, SignedURLExpiry: expiry}
}

// Serve handles requests to /media/* and /transcoded/* by reading
// the requested file from the storage backend.
// If the video's preset has signed_url_enabled, the request must carry
// valid ?sig= and ?exp= query parameters.
func (h *MediaHandler) Serve(w http.ResponseWriter, r *http.Request) {
	filePath := strings.TrimPrefix(r.URL.Path, "/")

	// Prevent directory traversal
	if strings.Contains(filePath, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	// Check if signed URL enforcement is needed for this video
	ps := h.resolvePresetSecurity(r.Context(), filePath)
	if ps != nil && ps.SignedURLEnabled {
		sig := r.URL.Query().Get("sig")
		expStr := r.URL.Query().Get("exp")
		exp, _ := strconv.ParseInt(expStr, 10, 64)

		if sig == "" || exp == 0 || !h.signer.Verify(filePath, sig, exp) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	rc, err := h.storage.Get(filePath)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer rc.Close()

	ext := filepath.Ext(filePath)
	contentType := mime.TypeByExtension(ext)
	switch ext {
	case ".m3u8":
		contentType = "application/vnd.apple.mpegurl"
	case ".ts":
		contentType = "video/mp2t"
	case ".key":
		contentType = "application/octet-stream"
	case ".json":
		contentType = "application/json"
	case ".vtt":
		contentType = "text/vtt"
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")

	// If serving an HLS manifest and signing is enabled, rewrite segment/key URLs.
	if ext == ".m3u8" && ps != nil && ps.SignedURLEnabled {
		w.Header().Set("Cache-Control", "no-cache") // manifests with signed URLs must not be cached
		h.serveSignedManifest(w, rc, filePath, ps.SignedURLExpiry)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000")
	io.Copy(w, rc)
}

// resolvePresetSecurity extracts video ID from the path and looks up the preset.
func (h *MediaHandler) resolvePresetSecurity(ctx context.Context, filePath string) *presetSecurity {
	m := videoIDRegex.FindStringSubmatch(filePath)
	if len(m) < 2 {
		return nil
	}
	vid, err := uuid.Parse(m[1])
	if err != nil {
		return nil
	}
	return h.lookupPresetSecurity(ctx, vid)
}

// serveSignedManifest reads an HLS playlist line by line and rewrites
// relative URIs (segments, keys) to include signed query parameters.
func (h *MediaHandler) serveSignedManifest(w http.ResponseWriter, rc io.Reader, manifestPath string, expirySeconds int) {
	baseDir := filepath.ToSlash(filepath.Dir(manifestPath))
	scanner := bufio.NewScanner(rc)
	for scanner.Scan() {
		line := scanner.Text()

		// Rewrite #EXT-X-KEY URI="..." directives
		if strings.HasPrefix(line, "#EXT-X-KEY") {
			line = h.rewriteKeyLine(line, baseDir, expirySeconds)
			fmt.Fprintln(w, line)
			continue
		}

		// Rewrite #EXT-X-STREAM-INF variant playlist references (master playlist)
		// The URI is on the NEXT line for STREAM-INF, but it's a plain relative path.
		if !strings.HasPrefix(line, "#") && strings.TrimSpace(line) != "" {
			segPath := resolveRelativePath(baseDir, strings.TrimSpace(line))
			q := h.signer.SignQuery(segPath, expirySeconds)
			if strings.Contains(line, "?") {
				fmt.Fprintf(w, "%s&%s\n", line, q)
			} else {
				fmt.Fprintf(w, "%s?%s\n", line, q)
			}
			continue
		}

		fmt.Fprintln(w, line)
	}
}

// rewriteKeyLine rewrites the URI in #EXT-X-KEY:METHOD=AES-128,URI="enc.key",...
func (h *MediaHandler) rewriteKeyLine(line, baseDir string, expirySeconds int) string {
	uriStart := strings.Index(line, `URI="`)
	if uriStart < 0 {
		return line
	}
	uriStart += 5 // skip URI="
	uriEnd := strings.Index(line[uriStart:], `"`)
	if uriEnd < 0 {
		return line
	}
	rawURI := line[uriStart : uriStart+uriEnd]
	keyPath := resolveRelativePath(baseDir, rawURI)
	q := h.signer.SignQuery(keyPath, expirySeconds)

	var signedURI string
	if strings.Contains(rawURI, "?") {
		signedURI = rawURI + "&" + q
	} else {
		signedURI = rawURI + "?" + q
	}
	return line[:uriStart] + signedURI + line[uriStart+uriEnd:]
}

// resolveRelativePath turns a relative segment reference into a full storage path.
func resolveRelativePath(baseDir, ref string) string {
	if strings.HasPrefix(ref, "/") || strings.Contains(ref, "://") {
		return ref
	}
	return baseDir + "/" + ref
}
