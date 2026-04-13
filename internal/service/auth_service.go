package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrUserExists         = errors.New("user with this email or username already exists")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type AuthService struct {
	userRepo         *repository.UserRepository
	jwtSecret        []byte
	accessExpiryMin  int
	refreshExpiryDay int
}

func NewAuthService(userRepo *repository.UserRepository, jwtSecret string, accessMin, refreshDay int) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		jwtSecret:        []byte(jwtSecret),
		accessExpiryMin:  accessMin,
		refreshExpiryDay: refreshDay,
	}
}

func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.User, error) {
	existing, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &model.User{
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: string(hash),
		Role:         "user",
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) Login(ctx context.Context, req model.LoginRequest) (*model.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}
	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	accessToken, err := s.generateToken(user, time.Duration(s.accessExpiryMin)*time.Minute, "access")
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.generateToken(user, time.Duration(s.refreshExpiryDay)*24*time.Hour, "refresh")
	if err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    s.accessExpiryMin * 60,
		User:         *user,
	}, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.RefreshResponse, error) {
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}
	if claims.TokenType != "refresh" {
		return nil, ErrInvalidToken
	}

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil || user == nil || !user.IsActive {
		return nil, ErrInvalidToken
	}

	accessToken, err := s.generateToken(user, time.Duration(s.accessExpiryMin)*time.Minute, "access")
	if err != nil {
		return nil, err
	}

	return &model.RefreshResponse{
		AccessToken: accessToken,
		ExpiresIn:   s.accessExpiryMin * 60,
	}, nil
}

// TokenClaims holds the custom JWT claims.
type TokenClaims struct {
	jwt.RegisteredClaims
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role"`
	TokenType string    `json:"token_type"`
}

func (s *AuthService) generateToken(user *model.User, expiry time.Duration, tokenType string) (string, error) {
	claims := TokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
		},
		UserID:    user.ID,
		Role:      user.Role,
		TokenType: tokenType,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) ValidateToken(tokenStr string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &TokenClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*TokenClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (s *AuthService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(hash), err
}

// IssueTokens creates access + refresh tokens for a user (used by Google/passkey login).
func (s *AuthService) IssueTokens(ctx context.Context, user *model.User) (*model.LoginResponse, error) {
	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	accessToken, err := s.generateToken(user, time.Duration(s.accessExpiryMin)*time.Minute, "access")
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.generateToken(user, time.Duration(s.refreshExpiryDay)*24*time.Hour, "refresh")
	if err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    s.accessExpiryMin * 60,
		User:         *user,
	}, nil
}
