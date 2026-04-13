package model

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user account.
type User struct {
	ID                  uuid.UUID  `json:"id"`
	Email               string     `json:"email"`
	Username            string     `json:"username"`
	PasswordHash        string     `json:"-"`
	Role                string     `json:"role"`
	IsActive            bool       `json:"is_active"`
	AvatarURL           *string    `json:"avatar_url,omitempty"`
	GoogleID            *string    `json:"-"`
	HasGoogle           bool       `json:"has_google"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	PasswordChangedAt   *time.Time `json:"password_changed_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	TotalVideosUploaded int        `json:"total_videos_uploaded"`
	PasskeyCount        int        `json:"passkey_count"`
}

// AccountSession represents a device/login session entry.
type AccountSession struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	DeviceName    string    `json:"device_name"`
	DeviceOS      string    `json:"device_os"`
	Browser       string    `json:"browser"`
	IPAddress     *string   `json:"ip_address,omitempty"`
	Location      string    `json:"location"`
	LastSessionAt time.Time `json:"last_session_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// RegisterRequest is the payload for user registration.
type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginRequest is the payload for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse is the response for a successful login.
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	User         User   `json:"user"`
}

// RefreshRequest is the payload for token refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshResponse is the response for a successful token refresh.
type RefreshResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

// UpdateUserRequest is the payload for updating a user (admin).
type UpdateUserRequest struct {
	Email    *string `json:"email,omitempty"`
	Username *string `json:"username,omitempty"`
	Role     *string `json:"role,omitempty"`
	IsActive *bool   `json:"is_active,omitempty"`
}

// ChangePasswordRequest is the payload for changing a user's password.
type ChangePasswordRequest struct {
	NewPassword string `json:"new_password"`
}

// CreateUserRequest is the payload for admin user creation.
type CreateUserRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// WebAuthnCredential represents a stored passkey credential.
type WebAuthnCredential struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	CredentialID    []byte    `json:"-"`
	PublicKey       []byte    `json:"-"`
	AttestationType string    `json:"-"`
	AAGUID          []byte    `json:"-"`
	SignCount       uint32    `json:"sign_count"`
	BackupEligible  bool      `json:"-"`
	BackupState     bool      `json:"-"`
	Name            string    `json:"name"`
	CreatedAt       time.Time `json:"created_at"`
}
