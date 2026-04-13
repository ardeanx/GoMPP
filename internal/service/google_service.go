package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// GoogleUser holds the profile information extracted from a verified Google ID token.
type GoogleUser struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified,string"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// GoogleService verifies Google ID tokens via Google's tokeninfo endpoint.
type GoogleService struct {
	clientID   string
	httpClient *http.Client
}

// NewGoogleService creates a GoogleService. Pass an empty clientID to disable.
func NewGoogleService(clientID string) *GoogleService {
	return &GoogleService{
		clientID: clientID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Enabled reports whether Google sign-in is configured.
func (s *GoogleService) Enabled() bool {
	return s.clientID != ""
}

// ClientID returns the configured Google client ID.
func (s *GoogleService) ClientID() string {
	return s.clientID
}

// VerifyAccessToken validates a Google OAuth2 access token via the userinfo endpoint.
func (s *GoogleService) VerifyAccessToken(ctx context.Context, accessToken string) (*GoogleUser, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("google sign-in is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling userinfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token (status %d)", resp.StatusCode)
	}

	var info struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decoding userinfo response: %w", err)
	}

	if info.Sub == "" || info.Email == "" {
		return nil, fmt.Errorf("incomplete user info from Google")
	}

	return &GoogleUser{
		Sub:           info.Sub,
		Email:         info.Email,
		EmailVerified: info.EmailVerified,
		Name:          info.Name,
		Picture:       info.Picture,
	}, nil
}
