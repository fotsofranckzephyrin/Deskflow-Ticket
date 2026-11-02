package postgres

import (
	"context"
	"errors"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) Create(ctx context.Context, comment *domain.TicketComment) error {
	if comment == nil {
		return errors.New("comment is nil")
	}
	if comment.ID == uuid.Nil {
		comment.ID = uuid.New()
	}
	if comment.CreatedAt.IsZero() {
		comment.CreatedAt = time.Now()
	}
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *CommentRepository) ListByTicket(ctx context.Context, ticketID uuid.UUID) ([]*domain.TicketComment, error) {
	var comments []*domain.TicketComment
	if err := r.db.WithContext(ctx).Where("ticket_id = ?", ticketID).Order("created_at ASC").Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}
