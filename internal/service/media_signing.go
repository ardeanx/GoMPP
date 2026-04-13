package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"
)

// MediaSigner handles HMAC-SHA256 signing and verification of media URLs.
// The signing secret is derived from the application JWT secret + a fixed salt.
type MediaSigner struct {
	key []byte
}

// NewMediaSigner creates a signer using the given base secret (typically JWT secret).
func NewMediaSigner(baseSecret string) *MediaSigner {
	// Derive a separate key for media signing so it doesn't share the exact JWT key.
	h := sha256.New()
	h.Write([]byte(baseSecret))
	h.Write([]byte(":gompp-media-signing"))
	return &MediaSigner{key: h.Sum(nil)}
}

// Sign generates a signature and expiry for the given path.
// expirySeconds controls how long the URL is valid.
func (s *MediaSigner) Sign(path string, expirySeconds int) (sig string, exp int64) {
	exp = time.Now().Unix() + int64(expirySeconds)
	sig = s.computeHMAC(path, exp)
	return sig, exp
}

// Verify checks that the signature is valid and the URL has not expired.
func (s *MediaSigner) Verify(path, sig string, exp int64) bool {
	if time.Now().Unix() > exp {
		return false
	}
	expected := s.computeHMAC(path, exp)
	return hmac.Equal([]byte(expected), []byte(sig))
}

func (s *MediaSigner) computeHMAC(path string, exp int64) string {
	mac := hmac.New(sha256.New, s.key)
	mac.Write([]byte(fmt.Sprintf("%s:%s", path, strconv.FormatInt(exp, 10))))
	return hex.EncodeToString(mac.Sum(nil))
}

// SignQuery returns the query string parameters to append (without leading ?/&).
func (s *MediaSigner) SignQuery(path string, expirySeconds int) string {
	sig, exp := s.Sign(path, expirySeconds)
	return fmt.Sprintf("sig=%s&exp=%d", sig, exp)
}
