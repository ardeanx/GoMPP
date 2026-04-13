package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
	"github.com/subosito/gotenv"
)

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	Log       LogConfig
	JWT       JWTConfig
	Storage   StorageConfig
	Transcode TranscodeConfig
	Google    GoogleConfig
	WebAuthn  WebAuthnConfig
	RateLimit RateLimitConfig
}

// RateLimitConfig
type RateLimitConfig struct {
	AuthRPM    int `mapstructure:"auth_rpm"`    // public/auth routes, default 10
	GeneralRPM int `mapstructure:"general_rpm"` // authenticated routes, default 60
}

// GoogleConfig
type GoogleConfig struct {
	ClientID string `mapstructure:"client_id"`
}

// WebAuthnConfig
type WebAuthnConfig struct {
	RPDisplayName string   `mapstructure:"rp_display_name"`
	RPID          string   `mapstructure:"rp_id"`
	RPOrigins     []string `mapstructure:"rp_origins"`
}

// ServerConfig
type ServerConfig struct {
	Host        string
	Port        int
	CORSOrigins []string `mapstructure:"cors_origins"`
}

// DatabaseConfig
type DatabaseConfig struct {
	Host               string
	Port               int
	User               string
	Password           string
	Name               string
	SSLMode            string
	MaxConns           int32 `mapstructure:"max_conns"`
	MinConns           int32 `mapstructure:"min_conns"`
	MaxConnLifetimeMin int   `mapstructure:"max_conn_lifetime_min"`
	MaxConnIdleMin     int   `mapstructure:"max_conn_idle_min"`
	HealthCheckMin     int   `mapstructure:"health_check_min"`
}

// LogConfig
type LogConfig struct {
	Level  string
	Format string
}

// JWTConfig
type JWTConfig struct {
	Secret           string `mapstructure:"secret"`
	AccessExpiryMin  int    `mapstructure:"accessexpiry_min"`
	RefreshExpiryDay int    `mapstructure:"refreshexpiry_day"`
}

// StorageConfig
type StorageConfig struct {
	Backend        string
	BasePath       string
	S3Bucket       string `mapstructure:"s3_bucket"`
	S3Region       string `mapstructure:"s3_region"`
	S3Endpoint     string `mapstructure:"s3_endpoint"`
	S3AccessKey    string `mapstructure:"s3_access_key"`
	S3SecretKey    string `mapstructure:"s3_secret_key"`
	S3UsePathStyle bool   `mapstructure:"s3_use_path_style"`
	S3PublicURL    string `mapstructure:"s3_public_url"`
	S3Prefix       string `mapstructure:"s3_prefix"`
}

// TranscodeConfig
type TranscodeConfig struct {
	Workers     int
	FFmpegPath  string
	FFprobePath string `mapstructure:"ffprobepath"`
	TempDir     string
}

// DSN returns the PostgreSQL connection string.
func (db DatabaseConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		db.User, db.Password, db.Host, db.Port, db.Name, db.SSLMode)
}

// Load reads configuration from .env, config files, and environment variables.
func Load() (*Config, error) {
	_ = gotenv.OverLoad()

	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetEnvPrefix("GOMPP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	cfg.Server.Host = v.GetString("server.host")
	cfg.Server.Port = v.GetInt("server.port")

	// SetDefault hint, so fall back to manual splitting when needed.
	if origins := v.GetStringSlice("server.cors_origins"); len(origins) == 1 && strings.Contains(origins[0], ",") {
		cfg.Server.CORSOrigins = strings.Split(origins[0], ",")
	} else {
		cfg.Server.CORSOrigins = origins
	}

	cfg.Database.Host = v.GetString("database.host")
	cfg.Database.Port = v.GetInt("database.port")
	cfg.Database.User = v.GetString("database.user")
	cfg.Database.Password = v.GetString("database.password")
	cfg.Database.Name = v.GetString("database.name")
	cfg.Database.SSLMode = v.GetString("database.sslmode")
	cfg.Database.MaxConns = int32(v.GetInt("database.max_conns"))
	cfg.Database.MinConns = int32(v.GetInt("database.min_conns"))
	cfg.Database.MaxConnLifetimeMin = v.GetInt("database.max_conn_lifetime_min")
	cfg.Database.MaxConnIdleMin = v.GetInt("database.max_conn_idle_min")
	cfg.Database.HealthCheckMin = v.GetInt("database.health_check_min")

	cfg.Log.Level = v.GetString("log.level")
	cfg.Log.Format = v.GetString("log.format")

	cfg.JWT.Secret = v.GetString("jwt.secret")
	cfg.JWT.AccessExpiryMin = v.GetInt("jwt.accessexpiry_min")
	cfg.JWT.RefreshExpiryDay = v.GetInt("jwt.refreshexpiry_day")

	cfg.Storage.Backend = v.GetString("storage.backend")
	cfg.Storage.BasePath = v.GetString("storage.basepath")
	cfg.Storage.S3Bucket = v.GetString("storage.s3_bucket")
	cfg.Storage.S3Region = v.GetString("storage.s3_region")
	cfg.Storage.S3Endpoint = v.GetString("storage.s3_endpoint")
	cfg.Storage.S3AccessKey = v.GetString("storage.s3_access_key")
	cfg.Storage.S3SecretKey = v.GetString("storage.s3_secret_key")
	cfg.Storage.S3UsePathStyle = v.GetBool("storage.s3_use_path_style")
	cfg.Storage.S3PublicURL = v.GetString("storage.s3_public_url")
	cfg.Storage.S3Prefix = v.GetString("storage.s3_prefix")

	cfg.Transcode.Workers = v.GetInt("transcode.workers")
	cfg.Transcode.FFmpegPath = v.GetString("transcode.ffmpegpath")
	cfg.Transcode.FFprobePath = v.GetString("transcode.ffprobepath")
	cfg.Transcode.TempDir = v.GetString("transcode.tempdir")

	cfg.Google.ClientID = v.GetString("google.client_id")

	cfg.WebAuthn.RPDisplayName = v.GetString("webauthn.rp_display_name")
	cfg.WebAuthn.RPID = v.GetString("webauthn.rp_id")
	if origins := v.GetStringSlice("webauthn.rp_origins"); len(origins) == 1 && strings.Contains(origins[0], ",") {
		cfg.WebAuthn.RPOrigins = strings.Split(origins[0], ",")
	} else {
		cfg.WebAuthn.RPOrigins = origins
	}

	cfg.RateLimit.AuthRPM = v.GetInt("ratelimit.auth_rpm")
	cfg.RateLimit.GeneralRPM = v.GetInt("ratelimit.general_rpm")
	if cfg.RateLimit.AuthRPM <= 0 {
		cfg.RateLimit.AuthRPM = 10
	}
	if cfg.RateLimit.GeneralRPM <= 0 {
		cfg.RateLimit.GeneralRPM = 60
	}

	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("jwt.secret is required: set GOMPP_JWT_SECRET environment variable")
	}

	return &cfg, nil
}
