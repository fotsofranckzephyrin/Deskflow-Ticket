package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"deskflow/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	userRepo  domain.UserRepository
	jwtSecret string
	email     domain.EmailSender
}

type jwtClaims struct {
	UserID uuid.UUID       `json:"user_id"`
	Email  string          `json:"email"`
	Role   domain.UserRole `json:"role"`
	jwt.RegisteredClaims
}

func NewAuthService(userRepo domain.UserRepository, jwtSecret string, emailSenders ...domain.EmailSender) *AuthService {
	var emailSender domain.EmailSender
	if len(emailSenders) > 0 {
		emailSender = emailSenders[0]
	}
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		email:     emailSender,
	}
}

func (s *AuthService) RequestPasswordReset(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if _, err := mail.ParseAddress(email); err != nil {
		return fmt.Errorf("%w: adresse e-mail invalide", domain.ErrInvalidInput)
	}
	if s.email == nil {
		return errors.New("service d'envoi d'e-mail non configuré")
	}
	user, err := s.userRepo.GetByEmail(ctx, email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	now := time.Now()
	if user.PasswordResetRequestedAt != nil && now.Sub(*user.PasswordResetRequestedAt) < 30*24*time.Hour {
		return domain.ErrPasswordResetCooldown
	}
	number, err := rand.Int(rand.Reader, big.NewInt(100000000))
	if err != nil {
		return fmt.Errorf("generate password reset code: %w", err)
	}
	code := fmt.Sprintf("%08d", number.Int64())
	expiresAt := now.Add(15 * time.Minute)
	codeHash := s.passwordResetHash(email, code)
	if err := s.userRepo.SetPasswordResetCode(ctx, user.ID, codeHash, expiresAt, now); err != nil {
		return err
	}
	body := fmt.Sprintf("Votre code DeskFlow est : %s\n\nCe code expire dans 15 minutes. Par sécurité, ne le partagez avec personne.", code)
	if err := s.email.Send(email, "Réinitialisation de votre mot de passe DeskFlow", body); err != nil {
		if clearErr := s.userRepo.ClearPasswordResetCode(ctx, user.ID, codeHash); clearErr != nil {
			return fmt.Errorf("envoi du code impossible: %v; nettoyage du code impossible: %w", err, clearErr)
		}
		return err
	}
	return nil
}

func (s *AuthService) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	code = strings.TrimSpace(code)
	newPassword = strings.TrimSpace(newPassword)
	if _, err := mail.ParseAddress(email); err != nil || len(code) != 8 || len(newPassword) < 8 {
		return fmt.Errorf("%w: e-mail, code ou mot de passe invalide", domain.ErrInvalidInput)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password reset: %w", err)
	}
	return s.userRepo.CompletePasswordReset(ctx, email, s.passwordResetHash(email, code), string(hash), time.Now())
}

func (s *AuthService) passwordResetHash(email, code string) string {
	mac := hmac.New(sha256.New, []byte(s.jwtSecret))
	_, _ = mac.Write([]byte(email + ":" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *AuthService) Register(ctx context.Context, fullName, email, password, department, matricule string, role domain.UserRole) (*domain.User, string, error) {
	fullName = strings.TrimSpace(fullName)
	email = strings.ToLower(strings.TrimSpace(email))
	password = strings.TrimSpace(password)
	department = strings.TrimSpace(department)
	matricule = strings.ToUpper(strings.TrimSpace(matricule))

	if fullName == "" || email == "" || password == "" || department == "" {
		return nil, "", errors.New("champs requis manquants")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, "", errors.New("adresse e-mail invalide")
	}
	if len(password) < 8 {
		return nil, "", errors.New("le mot de passe doit comporter au moins 8 caractères")
	}

	existing, err := s.userRepo.GetByEmail(ctx, email)
	if err == nil && existing != nil {
		return nil, "", errors.New("email déjà utilisé")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", fmt.Errorf("lookup email: %w", err)
	}
	if matricule == "" {
		matricule = "AGT-" + strings.ToUpper(uuid.NewString()[:8])
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("hash password: %w", err)
	}

	user := &domain.User{
		ID:           uuid.New(),
		FullName:     fullName,
		Email:        email,
		Matricule:    matricule,
		PasswordHash: string(hash),
		Role:         role,
		Department:   department,
		IsActive:     true,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, "", err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

func (s *AuthService) Login(ctx context.Context, identifier, password string) (*domain.User, string, error) {
	identifier = strings.TrimSpace(identifier)
	password = strings.TrimSpace(password)

	if identifier == "" || password == "" {
		return nil, "", domain.ErrInvalidCredentials
	}

	user, err := s.userRepo.GetByIdentifier(ctx, identifier)
	if err != nil {
		return nil, "", domain.ErrInvalidCredentials
	}
	if user == nil {
		return nil, "", domain.ErrInvalidCredentials
	}
	if !user.IsActive {
		return nil, "", domain.ErrUserInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", domain.ErrInvalidCredentials
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

func (s *AuthService) UpdateProfile(ctx context.Context, userID uuid.UUID, fullName, email string) (*domain.User, error) {
	fullName = strings.TrimSpace(fullName)
	email = strings.ToLower(strings.TrimSpace(email))

	if fullName == "" || len(fullName) > 100 || email == "" || len(email) > 150 {
		return nil, fmt.Errorf("%w: nom et e-mail obligatoires", domain.ErrInvalidInput)
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, fmt.Errorf("%w: adresse e-mail invalide", domain.ErrInvalidInput)
	}

	existingEmail, err := s.userRepo.GetByEmail(ctx, email)
	if err == nil && existingEmail.ID != userID {
		return nil, domain.ErrIdentityConflict
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("lookup email: %w", err)
	}
	if err := s.userRepo.UpdateProfile(ctx, userID, fullName, email); err != nil {
		return nil, err
	}
	return s.userRepo.GetByID(ctx, userID)
}

func (s *AuthService) ValidateToken(tokenString string) (uuid.UUID, domain.UserRole, error) {
	if tokenString == "" {
		return uuid.Nil, "", domain.ErrInvalidCredentials
	}

	token, err := jwt.ParseWithClaims(tokenString, &jwtClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return uuid.Nil, "", err
	}

	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return uuid.Nil, "", domain.ErrInvalidCredentials
	}

	return claims.UserID, claims.Role, nil
}

func (s *AuthService) generateToken(user *domain.User) (string, error) {
	expiresAt := time.Now().Add(12 * time.Hour)
	claims := jwtClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
