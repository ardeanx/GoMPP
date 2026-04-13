package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/model"
)

// WebAuthnService wraps the go-webauthn library and provides stateless
// session handling via HMAC-signed session tokens.
type WebAuthnService struct {
	wan       *webauthn.WebAuthn
	secretKey []byte
}

// NewWebAuthnService creates a new WebAuthn service. Pass empty rpID to disable.
func NewWebAuthnService(rpDisplayName, rpID string, rpOrigins []string, jwtSecret string) (*WebAuthnService, error) {
	if rpID == "" {
		return &WebAuthnService{}, nil
	}

	wan, err := webauthn.New(&webauthn.Config{
		RPDisplayName: rpDisplayName,
		RPID:          rpID,
		RPOrigins:     rpOrigins,
	})
	if err != nil {
		return nil, fmt.Errorf("creating webauthn: %w", err)
	}

	return &WebAuthnService{
		wan:       wan,
		secretKey: []byte(jwtSecret),
	}, nil
}

// Enabled reports whether WebAuthn is configured.
func (s *WebAuthnService) Enabled() bool {
	return s.wan != nil
}

// Session token helpers

type sessionEnvelope struct {
	Data      []byte `json:"d"`
	ExpiresAt int64  `json:"e"`
}

// encodeSession marshals WebAuthn session data into a signed, base64-encoded token.
func (s *WebAuthnService) encodeSession(sd *webauthn.SessionData) (string, error) {
	raw, err := json.Marshal(sd)
	if err != nil {
		return "", err
	}
	env := sessionEnvelope{
		Data:      raw,
		ExpiresAt: time.Now().Add(5 * time.Minute).Unix(),
	}
	envJSON, err := json.Marshal(env)
	if err != nil {
		return "", err
	}

	mac := hmac.New(sha256.New, s.secretKey)
	mac.Write(envJSON)
	sig := mac.Sum(nil)

	// payload = base64(envJSON) + "." + base64(sig)
	return base64.RawURLEncoding.EncodeToString(envJSON) + "." +
		base64.RawURLEncoding.EncodeToString(sig), nil
}

// decodeSession verifies and decodes a session token back into SessionData.
func (s *WebAuthnService) decodeSession(token string) (*webauthn.SessionData, error) {
	parts := splitDot(token)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid session token format")
	}

	envJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decoding session payload: %w", err)
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decoding session signature: %w", err)
	}

	// Verify HMAC
	mac := hmac.New(sha256.New, s.secretKey)
	mac.Write(envJSON)
	if !hmac.Equal(mac.Sum(nil), sigBytes) {
		return nil, fmt.Errorf("session token signature invalid")
	}

	var env sessionEnvelope
	if err := json.Unmarshal(envJSON, &env); err != nil {
		return nil, fmt.Errorf("unmarshaling session envelope: %w", err)
	}
	if time.Now().Unix() > env.ExpiresAt {
		return nil, fmt.Errorf("session token expired")
	}

	var sd webauthn.SessionData
	if err := json.Unmarshal(env.Data, &sd); err != nil {
		return nil, fmt.Errorf("unmarshaling session data: %w", err)
	}
	return &sd, nil
}

func splitDot(s string) []string {
	for i := range s {
		if s[i] == '.' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}

// Registration

// BeginRegistration starts the WebAuthn registration ceremony for a user.
func (s *WebAuthnService) BeginRegistration(user *model.User, existingCreds []model.WebAuthnCredential) (
	*protocol.CredentialCreation, string, error,
) {
	if !s.Enabled() {
		return nil, "", fmt.Errorf("webauthn is not configured")
	}

	wanUser := newWebAuthnUser(user, existingCreds)

	options, session, err := s.wan.BeginRegistration(wanUser,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementPreferred),
	)
	if err != nil {
		return nil, "", fmt.Errorf("begin registration: %w", err)
	}

	token, err := s.encodeSession(session)
	if err != nil {
		return nil, "", err
	}

	return options, token, nil
}

// FinishRegistration completes the WebAuthn registration ceremony.
func (s *WebAuthnService) FinishRegistration(
	user *model.User,
	existingCreds []model.WebAuthnCredential,
	sessionToken string,
	r *protocol.ParsedCredentialCreationData,
) (*model.WebAuthnCredential, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("webauthn is not configured")
	}

	session, err := s.decodeSession(sessionToken)
	if err != nil {
		return nil, err
	}

	wanUser := newWebAuthnUser(user, existingCreds)

	cred, err := s.wan.CreateCredential(wanUser, *session, r)
	if err != nil {
		return nil, fmt.Errorf("create credential: %w", err)
	}

	return &model.WebAuthnCredential{
		UserID:          user.ID,
		CredentialID:    cred.ID,
		PublicKey:       cred.PublicKey,
		AttestationType: cred.AttestationType,
		AAGUID:          cred.Authenticator.AAGUID,
		SignCount:       cred.Authenticator.SignCount,
		BackupEligible:  cred.Flags.BackupEligible,
		BackupState:     cred.Flags.BackupState,
	}, nil
}

// Discoverable Login

// BeginDiscoverableLogin starts a passwordless login ceremony.
func (s *WebAuthnService) BeginDiscoverableLogin() (*protocol.CredentialAssertion, string, error) {
	if !s.Enabled() {
		return nil, "", fmt.Errorf("webauthn is not configured")
	}

	options, session, err := s.wan.BeginDiscoverableLogin()
	if err != nil {
		return nil, "", fmt.Errorf("begin discoverable login: %w", err)
	}

	token, err := s.encodeSession(session)
	if err != nil {
		return nil, "", err
	}
	return options, token, nil
}

// FinishDiscoverableLogin completes a passwordless login ceremony.
// The discoverUser callback resolves user handle → (User, credentials).
func (s *WebAuthnService) FinishDiscoverableLogin(
	sessionToken string,
	r *protocol.ParsedCredentialAssertionData,
	discoverUser func(rawID, userHandle []byte) (*model.User, []model.WebAuthnCredential, error),
) (*model.User, *webauthn.Credential, error) {
	if !s.Enabled() {
		return nil, nil, fmt.Errorf("webauthn is not configured")
	}

	session, err := s.decodeSession(sessionToken)
	if err != nil {
		return nil, nil, err
	}

	var foundUser *model.User

	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		log.Debug().Int("rawID_len", len(rawID)).Int("userHandle_len", len(userHandle)).Msg("discoverable login handler called")

		uid, err := uuid.FromBytes(userHandle)
		if err != nil {
			log.Error().Err(err).Int("len", len(userHandle)).Msg("invalid user handle bytes")
			return nil, fmt.Errorf("invalid user handle: %w", err)
		}
		log.Debug().Str("uid", uid.String()).Msg("resolved user ID from handle")

		user, creds, err := discoverUser(rawID, userHandle)
		if err != nil {
			log.Error().Err(err).Msg("discoverUser failed")
			return nil, err
		}
		log.Debug().Int("creds", len(creds)).Msg("user found with credentials")
		foundUser = user
		return newWebAuthnUser(user, creds), nil
	}

	cred, err := s.wan.ValidateDiscoverableLogin(handler, *session, r)
	if err != nil {
		log.Error().Err(err).Msg("ValidateDiscoverableLogin failed")
		return nil, nil, fmt.Errorf("validate discoverable login: %w", err)
	}

	return foundUser, cred, nil
}

// WebAuthn User adapter

type webAuthnUser struct {
	user  *model.User
	creds []webauthn.Credential
}

func newWebAuthnUser(u *model.User, creds []model.WebAuthnCredential) *webAuthnUser {
	wanCreds := make([]webauthn.Credential, len(creds))
	for i, c := range creds {
		wanCreds[i] = webauthn.Credential{
			ID:              c.CredentialID,
			PublicKey:       c.PublicKey,
			AttestationType: c.AttestationType,
			Flags: webauthn.CredentialFlags{
				BackupEligible: c.BackupEligible,
				BackupState:    c.BackupState,
			},
			Authenticator: webauthn.Authenticator{
				AAGUID:    c.AAGUID,
				SignCount: c.SignCount,
			},
		}
	}
	return &webAuthnUser{user: u, creds: wanCreds}
}

func (u *webAuthnUser) WebAuthnID() []byte {
	b, _ := u.user.ID.MarshalBinary()
	return b
}

func (u *webAuthnUser) WebAuthnName() string                       { return u.user.Email }
func (u *webAuthnUser) WebAuthnDisplayName() string                { return u.user.Username }
func (u *webAuthnUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }
