package postgres

import (
	"context"
	"errors"

	"deskflow/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SLARepository struct {
	db *gorm.DB
}

func NewSLARepository(db *gorm.DB) *SLARepository {
	return &SLARepository{db: db}
}

func (r *SLARepository) List(ctx context.Context) ([]*domain.SLAPolicy, error) {
	var policies []*domain.SLAPolicy
	if err := r.db.WithContext(ctx).Order("max_hours ASC").Find(&policies).Error; err != nil {
		return nil, err
	}
	return policies, nil
}

func (r *SLARepository) Get(ctx context.Context, priority domain.TicketPriority) (*domain.SLAPolicy, error) {
	var policy domain.SLAPolicy
	if err := r.db.WithContext(ctx).First(&policy, "priority = ?", priority).Error; err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *SLARepository) Upsert(ctx context.Context, policy *domain.SLAPolicy) error {
	if policy == nil || policy.MaxHours <= 0 {
		return errors.New("SLA policy is invalid")
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "priority"}},
		DoUpdates: clause.AssignmentColumns([]string{"max_hours", "description"}),
	}).Create(policy).Error
}
