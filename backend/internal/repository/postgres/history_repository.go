package postgres

import (
	"context"
	"errors"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type HistoryRepository struct {
	db *gorm.DB
}

func NewHistoryRepository(db *gorm.DB) *HistoryRepository {
	return &HistoryRepository{db: db}
}

func (r *HistoryRepository) Create(ctx context.Context, history *domain.TicketHistory) error {
	if history == nil {
		return errors.New("history is nil")
	}
	if history.ID == uuid.Nil {
		history.ID = uuid.New()
	}
	if history.CreatedAt.IsZero() {
		history.CreatedAt = time.Now()
	}
	return r.db.WithContext(ctx).Create(history).Error
}

func (r *HistoryRepository) ListByTicket(ctx context.Context, ticketID uuid.UUID) ([]*domain.TicketHistory, error) {
	var history []*domain.TicketHistory
	if err := r.db.WithContext(ctx).Where("ticket_id = ?", ticketID).Order("created_at ASC").Find(&history).Error; err != nil {
		return nil, err
	}
	return history, nil
}
