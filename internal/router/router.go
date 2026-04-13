package router

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/config"
	"github.com/gompp/gompp/internal/handler"
	appMiddleware "github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
)

// Deps holds all dependencies needed by the router.
type Deps struct {
	DB               *pgxpool.Pool
	AuthSvc          *service.AuthService
	AuthHandler      *handler.AuthHandler
	UserHandler      *handler.UserHandler
	VideoHandler     *handler.VideoHandler
	PresetHandler    *handler.PresetHandler
	WebhookHandler   *handler.WebhookHandler
	AnalyticsHandler *handler.AnalyticsHandler
	SettingsHandler  *handler.SettingsHandler
	ApiKeyHandler    *handler.ApiKeyHandler
	ApiKeyRepo       *repository.ApiKeyRepository
	EmbedHandler     *handler.EmbedHandler
	MediaHandler     *handler.MediaHandler
	AccountHandler   *handler.AccountHandler
	ProfileHandler   *handler.ProfileHandler
	SubtitlesHandler *handler.SubtitlesHandler
	Version          string
	RateLimitCfg     config.RateLimitConfig
}

// New creates and configures the chi router with all routes.
func New(d *Deps) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(appMiddleware.SecureHeaders)
	r.Use(appMiddleware.Logger)
	r.Use(appMiddleware.Metrics)
	r.Use(chiMiddleware.Recoverer)
	r.Use(corsMiddleware)
	r.Use(chiMiddleware.Timeout(60 * time.Second))

	// Health check
	r.Get("/health", healthCheck(d.DB, d.Version))

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// --- Public embed player ---
	r.Get("/embed/{id}", d.EmbedHandler.Player)
	r.Get("/embed/{id}/stream/*", d.EmbedHandler.Stream)

	// --- Public media serving (transcoded content) ---
	r.Get("/transcoded/*", d.MediaHandler.Serve)

	// --- Public subtitle serving ---
	r.Get("/subtitles/serve/{id}", d.SubtitlesHandler.ServeSubtitle)
	r.Get("/subtitles/public/{videoId}", d.SubtitlesHandler.PublicListSubtitles)

	// --- Public avatar serving ---
	r.Get("/avatars/*", d.ProfileHandler.ServeAvatar)
	// API v1
	r.Route("/api/v1", func(api chi.Router) {
		// Limit JSON request bodies to 1 MB
		api.Use(appMiddleware.MaxBodySize(1 << 20))

		// Named rate limiters (dynamically updated from system_settings)
		authLimiter := appMiddleware.NewRateLimiter(d.RateLimitCfg.AuthRPM, time.Minute)
		generalLimiter := appMiddleware.NewRateLimiter(d.RateLimitCfg.GeneralRPM, time.Minute)
		go watchRateLimits(d.DB, authLimiter, generalLimiter, d.RateLimitCfg)

		// --- Public routes (rate-limited) ---
		api.Group(func(pub chi.Router) {
			pub.Use(authLimiter.Handler)
			pub.Post("/auth/register", d.AuthHandler.Register)
			pub.Post("/auth/login", d.AuthHandler.Login)
			pub.Post("/auth/refresh", d.AuthHandler.Refresh)

			// Social / passkey authentication
			pub.Post("/auth/google", d.AuthHandler.GoogleLogin)
			pub.Post("/auth/passkey/begin", d.AuthHandler.PasskeyBeginLogin)
			pub.Post("/auth/passkey/finish", d.AuthHandler.PasskeyFinishLogin)
			pub.Get("/auth/providers", d.AuthHandler.AuthProviders)
			// Public video by slug (direct play)
			pub.Get("/public/videos/{slug}", d.VideoHandler.GetPublic)
			pub.Get("/public/videos/{slug}/download", d.VideoHandler.GetPublicDownload)

			// System settings (read-only, public for theme/branding)
			pub.Get("/settings", d.SettingsHandler.GetAll)
			pub.Get("/settings/{key}", d.SettingsHandler.GetByKey)
		})

		// --- Authenticated routes ---
		api.Group(func(auth chi.Router) {
			auth.Use(appMiddleware.Auth(d.AuthSvc, d.ApiKeyRepo))
			auth.Use(generalLimiter.Handler)

			// Auth
			auth.Post("/auth/logout", d.AuthHandler.Logout)
			auth.Get("/auth/me", d.AuthHandler.Me)

			// Videos
			auth.Post("/videos/upload", d.VideoHandler.Upload)
			auth.Get("/videos", d.VideoHandler.List)
			auth.Get("/videos/{id}", d.VideoHandler.Get)
			auth.Put("/videos/{id}", d.VideoHandler.Update)
			auth.Delete("/videos/{id}", d.VideoHandler.Delete)
			auth.Post("/videos/{id}/retranscode", d.VideoHandler.Retranscode)
			auth.Get("/videos/{id}/thumbnails", d.VideoHandler.ListThumbnails)
			auth.Put("/videos/{id}/thumbnail", d.VideoHandler.SetThumbnail)
			auth.Post("/videos/{id}/thumbnail/upload", d.VideoHandler.UploadThumbnail)

			// Presets
			auth.Get("/presets", d.PresetHandler.List)
			auth.Get("/presets/{id}", d.PresetHandler.Get)

			// Webhooks
			auth.Get("/webhooks", d.WebhookHandler.List)
			auth.Post("/webhooks", d.WebhookHandler.Create)
			auth.Get("/webhooks/{id}", d.WebhookHandler.Get)
			auth.Put("/webhooks/{id}", d.WebhookHandler.Update)
			auth.Delete("/webhooks/{id}", d.WebhookHandler.Delete)
			auth.Post("/webhooks/{id}/regenerate-secret", d.WebhookHandler.RegenerateSecret)
			auth.Get("/webhooks/{id}/deliveries", d.WebhookHandler.GetDeliveries)

			// API Keys
			auth.Get("/api-keys", d.ApiKeyHandler.List)
			auth.Post("/api-keys", d.ApiKeyHandler.Create)
			auth.Put("/api-keys/{id}", d.ApiKeyHandler.Update)
			auth.Delete("/api-keys/{id}", d.ApiKeyHandler.Delete)

			// Analytics
			auth.Get("/analytics/overview", d.AnalyticsHandler.Overview)
			auth.Get("/analytics/videos/{id}", d.AnalyticsHandler.VideoAnalytics)
			auth.Get("/analytics/top-videos", d.AnalyticsHandler.TopVideos)
			auth.Get("/analytics/bandwidth", d.AnalyticsHandler.Bandwidth)
			auth.Get("/analytics/device-types", d.AnalyticsHandler.DeviceTypes)
			auth.Get("/analytics/traffic", d.AnalyticsHandler.TrafficSeries)

			// User self-service (view/edit own profile, change password)
			auth.Get("/users/{id}", d.UserHandler.Get)
			auth.Put("/users/{id}", d.UserHandler.Update)
			auth.Put("/users/{id}/password", d.UserHandler.ChangePassword)

			// Subtitles (OpenSubtitles proxy)
			auth.Get("/subtitles/search", d.SubtitlesHandler.Search)
			auth.Post("/subtitles/download", d.SubtitlesHandler.Download)
			auth.Get("/subtitles/languages", d.SubtitlesHandler.Languages)

			// Video subtitles (attach/list/delete/upload)
			auth.Get("/videos/{id}/subtitles", d.SubtitlesHandler.ListSubtitles)
			auth.Post("/videos/{id}/subtitles/upload", d.SubtitlesHandler.UploadSubtitle)
			auth.Post("/videos/{id}/subtitles", d.SubtitlesHandler.AttachSubtitle)
			auth.Delete("/videos/{id}/subtitles/{subtitleId}", d.SubtitlesHandler.DeleteSubtitle)

			// Account sessions (device log)
			auth.Get("/account/sessions", d.AccountHandler.ListSessions)
			auth.Post("/account/sessions", d.AccountHandler.CreateSession)
			auth.Delete("/account/sessions/{id}", d.AccountHandler.DeleteSession)

			// Profile: avatar
			auth.Post("/account/avatar", d.ProfileHandler.UploadAvatar)
			auth.Delete("/account/avatar", d.ProfileHandler.DeleteAvatar)

			// Profile: Google account linking
			auth.Post("/account/google/link", d.ProfileHandler.LinkGoogle)
			auth.Delete("/account/google/link", d.ProfileHandler.UnlinkGoogle)

			// Profile: passkey management
			auth.Get("/account/passkeys", d.ProfileHandler.ListPasskeys)
			auth.Post("/account/passkeys/register/begin", d.ProfileHandler.BeginRegisterPasskey)
			auth.Post("/account/passkeys/register/finish", d.ProfileHandler.FinishRegisterPasskey)
			auth.Put("/account/passkeys/{id}", d.ProfileHandler.RenamePasskey)
			auth.Delete("/account/passkeys/{id}", d.ProfileHandler.DeletePasskey)
		})

		// --- Admin-only routes ---
		api.Group(func(admin chi.Router) {
			admin.Use(appMiddleware.Auth(d.AuthSvc, d.ApiKeyRepo))
			admin.Use(appMiddleware.RequireAdmin)

			// Users management (admin-only)
			admin.Get("/users", d.UserHandler.List)
			admin.Post("/users", d.UserHandler.Create)
			admin.Delete("/users/{id}", d.UserHandler.Delete)

			// Presets (write)
			admin.Post("/presets", d.PresetHandler.Create)
			admin.Put("/presets/{id}", d.PresetHandler.Update)
			admin.Delete("/presets/{id}", d.PresetHandler.Delete)

			// Settings
			admin.Put("/settings/{key}", d.SettingsHandler.Update)
			admin.Put("/settings", d.SettingsHandler.BulkUpdate)
			admin.Post("/settings/verify-ffmpeg", d.SettingsHandler.VerifyFFmpeg)
		})
	})

	return r
}

func healthCheck(db *pgxpool.Pool, version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "healthy"
		dbStatus := "connected"
		httpStatus := http.StatusOK

		if err := db.Ping(r.Context()); err != nil {
			status = "unhealthy"
			dbStatus = "disconnected"
			httpStatus = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(map[string]any{
			"status":    status,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"database":  dbStatus,
			"version":   version,
		})
	}
}

// allowedOrigins is the set of permitted CORS origins.
// Populated at startup via SetAllowedOrigins from config.
var allowedOrigins = map[string]struct{}{}

// SetAllowedOrigins replaces the default origin allowlist.
func SetAllowedOrigins(origins []string) {
	m := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		m[o] = struct{}{}
	}
	allowedOrigins = m
}

// corsMiddleware handles Cross-Origin Resource Sharing with an origin allowlist.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, ok := allowedOrigins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-API-Key, X-Request-ID")
				w.Header().Set("Access-Control-Max-Age", "3600")
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// watchRateLimits periodically reads rate-limit settings from the DB
func watchRateLimits(db *pgxpool.Pool, authRL, generalRL *appMiddleware.RateLimiter, defaults config.RateLimitConfig) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

		rows, err := db.Query(ctx,
			`SELECT key, value FROM system_settings WHERE key IN ('auth_rate_limit_rpm', 'rate_limit_rpm')`)
		if err != nil {
			cancel()
			continue
		}

		authRPM := defaults.AuthRPM
		generalRPM := defaults.GeneralRPM

		for rows.Next() {
			var key string
			var rawVal []byte
			if err := rows.Scan(&key, &rawVal); err != nil {
				continue
			}
			// value is stored as JSONB — could be a number or a quoted string
			var strVal string
			if err := json.Unmarshal(rawVal, &strVal); err != nil {
				// Try as raw number
				strVal = string(rawVal)
			}
			n, err := strconv.Atoi(strVal)
			if err != nil || n <= 0 {
				continue
			}
			switch key {
			case "auth_rate_limit_rpm":
				authRPM = n
			case "rate_limit_rpm":
				generalRPM = n
			}
		}
		rows.Close()
		cancel()

		if cur := authRL.Limit(); cur != authRPM {
			authRL.SetLimit(authRPM)
			log.Info().Int("old", cur).Int("new", authRPM).Msg("auth rate limit updated")
		}
		if cur := generalRL.Limit(); cur != generalRPM {
			generalRL.SetLimit(generalRPM)
			log.Info().Int("old", cur).Int("new", generalRPM).Msg("general rate limit updated")
		}
	}
}
