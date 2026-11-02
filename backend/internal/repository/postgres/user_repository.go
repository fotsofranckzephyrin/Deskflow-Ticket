package postgres

import (
	"context"
	"crypto/subtle"
	"errors"
	"strings"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	if user == nil {
		return errors.New("user is nil")
	}
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByIdentifier(ctx context.Context, identifier string) (*domain.User, error) {
	var user domain.User
	normalized := strings.TrimSpace(identifier)
	if err := r.db.WithContext(ctx).
		Where("LOWER(email) = ? OR UPPER(matricule) = ?", strings.ToLower(normalized), strings.ToUpper(normalized)).
		First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) List(ctx context.Context) ([]*domain.User, error) {
	var users []*domain.User
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id uuid.UUID, fullName, email string) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"full_name": fullName,
		"email":     email,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) UpdatePasswordHash(ctx context.Context, id uuid.UUID, passwordHash string) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", id).
		Update("password_hash", passwordHash)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) UpdateLastSeen(ctx context.Context, id uuid.UUID, ipAddress string, seenAt time.Time) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"last_ip_address": ipAddress,
		"last_seen_at":    seenAt,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) SetPasswordResetCode(ctx context.Context, id uuid.UUID, codeHash string, expiresAt, requestedAt time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user domain.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", id).Error; err != nil {
			return err
		}
		if user.PasswordResetRequestedAt != nil && requestedAt.Sub(*user.PasswordResetRequestedAt) < 30*24*time.Hour {
			return domain.ErrPasswordResetCooldown
		}
		return tx.Model(&user).Updates(map[string]interface{}{
			"password_reset_requested_at": requestedAt,
			"password_reset_code_hash":    codeHash,
			"password_reset_expires_at":   expiresAt,
			"password_reset_attempts":     0,
		}).Error
	})
}

func (r *UserRepository) ClearPasswordResetCode(ctx context.Context, id uuid.UUID, codeHash string) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ? AND password_reset_code_hash = ?", id, codeHash).
		Updates(map[string]interface{}{
			"password_reset_requested_at": nil,
			"password_reset_code_hash":    "",
			"password_reset_expires_at":   nil,
			"password_reset_attempts":     0,
		})
	return result.Error
}

func (r *UserRepository) CompletePasswordReset(ctx context.Context, email, codeHash, passwordHash string, now time.Time) error {
	var resetErr error
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user domain.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("LOWER(email) = ?", strings.ToLower(email)).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				resetErr = domain.ErrPasswordResetInvalid
				return nil
			}
			return err
		}
		if user.PasswordResetAttempts >= 5 || user.PasswordResetExpiresAt == nil ||
			!now.Before(*user.PasswordResetExpiresAt) || subtle.ConstantTimeCompare([]byte(user.PasswordResetCodeHash), []byte(codeHash)) != 1 {
			if user.PasswordResetAttempts < 5 {
				if err := tx.Model(&user).UpdateColumn("password_reset_attempts", user.PasswordResetAttempts+1).Error; err != nil {
					return err
				}
			}
			resetErr = domain.ErrPasswordResetInvalid
			return nil
		}
		return tx.Model(&user).Updates(map[string]interface{}{
			"password_hash":             passwordHash,
			"password_reset_code_hash":  "",
			"password_reset_expires_at": nil,
			"password_reset_attempts":   0,
		}).Error
	})
	if err != nil {
		return err
	}
	return resetErr
}

func (r *UserRepository) UpdateRole(ctx context.Context, id uuid.UUID, role domain.UserRole) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Update("role", role)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) UpdateDepartment(ctx context.Context, id uuid.UUID, department string) error {
	result := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Update("department", department)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *UserRepository) ToggleActive(ctx context.Context, id uuid.UUID) error {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		return err
	}
	result := r.db.WithContext(ctx).Model(&user).Update("is_active", !user.IsActive)
	return result.Error
}
