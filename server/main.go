package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/config"
	"github.com/gompp/gompp/internal/database"
	"github.com/gompp/gompp/internal/handler"
	"github.com/gompp/gompp/internal/middleware"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/router"
	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
	"github.com/gompp/gompp/internal/transcoder"
)

// Set via ldflags at build time.
var (
	version   = "dev"
	buildTime = "unknown"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Setup logging
	middleware.SetupLogger(cfg.Log.Level, cfg.Log.Format)

	log.Info().Msg("starting GoMPP server")
	log.Info().Str("version", version).Str("build_time", buildTime).Msg("build info")

	// Connect to database
	ctx := context.Background()
	db, err := database.Connect(ctx, cfg.Database.DSN(), database.PoolConfig{
		MaxConns:           cfg.Database.MaxConns,
		MinConns:           cfg.Database.MinConns,
		MaxConnLifetimeMin: cfg.Database.MaxConnLifetimeMin,
		MaxConnIdleMin:     cfg.Database.MaxConnIdleMin,
		HealthCheckMin:     cfg.Database.HealthCheckMin,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()
	log.Info().Msg("connected to database")

	// Run migrations 
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatal().Err(err).Msg("failed to run database migrations")
	}

	// Seed super admin
	if err := database.SeedSuperAdmin(ctx, db); err != nil {
		log.Warn().Err(err).Msg("failed to seed super admin")
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	videoRepo := repository.NewVideoRepository(db)
	presetRepo := repository.NewPresetRepository(db)
	jobRepo := repository.NewJobRepository(db)
	webhookRepo := repository.NewWebhookRepository(db)
	apiKeyRepo := repository.NewApiKeyRepository(db)
	accountSessionRepo := repository.NewAccountSessionRepository(db)
	subtitleRepo := repository.NewSubtitleRepository(db)
	credRepo := repository.NewCredentialRepository(db)

	// Storage backend
	var store storage.Backend
	switch cfg.Storage.Backend {
	case "s3":
		s3Store, err := storage.NewS3Backend(ctx, storage.S3Config{
			Bucket:          cfg.Storage.S3Bucket,
			Region:          cfg.Storage.S3Region,
			Endpoint:        cfg.Storage.S3Endpoint,
			AccessKeyID:     cfg.Storage.S3AccessKey,
			SecretAccessKey: cfg.Storage.S3SecretKey,
			UsePathStyle:    cfg.Storage.S3UsePathStyle,
			PublicURL:       cfg.Storage.S3PublicURL,
			Prefix:          cfg.Storage.S3Prefix,
		})
		if err != nil {
			log.Fatal().Err(err).Msg("failed to initialise S3 storage backend")
		}
		store = s3Store
		log.Info().Str("bucket", cfg.Storage.S3Bucket).Msg("using S3 storage backend")
	default:
		localStore, err := storage.NewLocalBackend(cfg.Storage.BasePath)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to initialise local storage backend")
		}
		store = localStore
		log.Info().Str("path", cfg.Storage.BasePath).Msg("using local storage backend")
	}

	// Services
	mediaSigner := service.NewMediaSigner(cfg.JWT.Secret)
	authSvc := service.NewAuthService(userRepo, cfg.JWT.Secret, cfg.JWT.AccessExpiryMin, cfg.JWT.RefreshExpiryDay)
	webhookSvc := service.NewWebhookService(webhookRepo)
	videoSvc := service.NewVideoService(videoRepo, jobRepo, presetRepo, store, webhookSvc, mediaSigner)
	googleSvc := service.NewGoogleService(cfg.Google.ClientID)
	webauthnSvc, err := service.NewWebAuthnService(cfg.WebAuthn.RPDisplayName, cfg.WebAuthn.RPID, cfg.WebAuthn.RPOrigins, cfg.JWT.Secret)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialise WebAuthn service")
	}
	_ = service.NewStorageService(store) // available when needed
	_ = service.NewTranscodeService(jobRepo, videoRepo, presetRepo, webhookSvc)

	// Seed default presets
	if err := transcoder.SeedDefaultPresets(ctx, presetRepo); err != nil {
		log.Warn().Err(err).Msg("failed to seed default presets")
	}

	// Transcoder worker pool
	ffmpeg := transcoder.NewFFmpeg(cfg.Transcode.FFmpegPath, cfg.Transcode.FFprobePath, cfg.Transcode.TempDir, store)
	numWorkers := cfg.Transcode.Workers
	// Override worker count from system_settings if available
	var dbWorkers int
	err = db.QueryRow(ctx,
		`SELECT value::text::int FROM system_settings WHERE key = 'max_concurrent_jobs'`).
		Scan(&dbWorkers)
	if err == nil && dbWorkers > 0 {
		numWorkers = dbWorkers
		log.Info().Int("workers", numWorkers).Msg("using max_concurrent_jobs from system settings")
	}
	pool := transcoder.NewWorkerPool(numWorkers, ffmpeg, jobRepo, videoRepo, presetRepo, webhookSvc, store)
	pool.Start(ctx)
	log.Info().Int("workers", numWorkers).Msg("transcoder worker pool started")

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc, userRepo, credRepo, googleSvc, webauthnSvc)
	userHandler := handler.NewUserHandler(userRepo, authSvc)
	videoHandler := handler.NewVideoHandler(videoSvc, videoRepo, store)
	presetHandler := handler.NewPresetHandler(presetRepo)
	webhookHandler := handler.NewWebhookHandler(webhookRepo)
	analyticsHandler := handler.NewAnalyticsHandler(db)
	settingsHandler := handler.NewSettingsHandler(db)
	apiKeyHandler := handler.NewApiKeyHandler(apiKeyRepo)
	embedHandler := handler.NewEmbedHandler(videoRepo, subtitleRepo, store, db, mediaSigner)
	mediaHandler := handler.NewMediaHandler(store, db, mediaSigner)
	accountHandler := handler.NewAccountHandler(accountSessionRepo)
	profileHandler := handler.NewProfileHandler(userRepo, credRepo, store, googleSvc, webauthnSvc)
	subtitlesHandler := handler.NewSubtitlesHandler(db, subtitleRepo, store)

	// Router
	router.SetAllowedOrigins(cfg.Server.CORSOrigins)
	r := router.New(&router.Deps{
		DB:               db,
		AuthSvc:          authSvc,
		AuthHandler:      authHandler,
		UserHandler:      userHandler,
		VideoHandler:     videoHandler,
		PresetHandler:    presetHandler,
		WebhookHandler:   webhookHandler,
		AnalyticsHandler: analyticsHandler,
		SettingsHandler:  settingsHandler,
		ApiKeyHandler:    apiKeyHandler,
		ApiKeyRepo:       apiKeyRepo,
		EmbedHandler:     embedHandler,
		MediaHandler:     mediaHandler,
		AccountHandler:   accountHandler,
		ProfileHandler:   profileHandler,
		SubtitlesHandler: subtitlesHandler,
		Version:          version,
		RateLimitCfg:     cfg.RateLimit,
	})

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  0, // disabled — large uploads
		WriteTimeout: 0, // disabled — rely on per-route chi Timeout
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Info().Msg("shutting down server")
		pool.Stop()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("server shutdown error")
		}
	}()

	// Start server
	log.Info().Str("addr", addr).Msg("server listening")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal().Err(err).Msg("server failed")
	}

	log.Info().Msg("server stopped")
}
