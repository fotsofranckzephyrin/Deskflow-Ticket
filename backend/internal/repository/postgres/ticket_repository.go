package postgres

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TicketRepository struct {
	db *gorm.DB
}

const maxShortTicketReference int64 = 36*36*36*36*36 - 1

func NewTicketRepository(db *gorm.DB) *TicketRepository {
	return &TicketRepository{db: db}
}

func (r *TicketRepository) EnsureShortReferences(ctx context.Context) error {
	if err := r.db.WithContext(ctx).Exec("CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq").Error; err != nil {
		return fmt.Errorf("create ticket reference sequence: %w", err)
	}

	type existingReference struct {
		TicketNumber string
	}
	var references []existingReference
	if err := r.db.WithContext(ctx).Model(&domain.Ticket{}).Select("ticket_number").Find(&references).Error; err != nil {
		return fmt.Errorf("read ticket references: %w", err)
	}
	var maxReference int64
	for _, reference := range references {
		if !strings.HasPrefix(reference.TicketNumber, "TCK-") {
			continue
		}
		suffix := strings.TrimPrefix(reference.TicketNumber, "TCK-")
		if len(suffix) < 5 || strings.ToUpper(suffix) != suffix {
			continue
		}
		value, err := strconv.ParseInt(suffix, 36, 64)
		if err == nil && value > maxReference {
			maxReference = value
		}
	}
	if maxReference > 0 {
		type sequenceState struct {
			LastValue int64 `gorm:"column:last_value"`
			IsCalled  bool  `gorm:"column:is_called"`
		}
		var state sequenceState
		if err := r.db.WithContext(ctx).Raw("SELECT last_value, is_called FROM ticket_reference_seq").Scan(&state).Error; err != nil {
			return fmt.Errorf("read ticket reference sequence: %w", err)
		}
		if maxReference > state.LastValue || (maxReference == state.LastValue && !state.IsCalled) {
			if err := r.db.WithContext(ctx).Exec("SELECT setval('ticket_reference_seq', ?, true)", maxReference).Error; err != nil {
				return fmt.Errorf("synchronize ticket reference sequence: %w", err)
			}
		}
	}

	var legacyTickets []struct {
		ID uuid.UUID `gorm:"column:id"`
	}
	if err := r.db.WithContext(ctx).Model(&domain.Ticket{}).
		Select("id").
		Where("ticket_number !~ ?", `^TCK-[0-9A-Z]{5}$`).
		Order("created_at ASC, id ASC").
		Find(&legacyTickets).Error; err != nil {
		return fmt.Errorf("find legacy ticket references: %w", err)
	}
	for _, legacy := range legacyTickets {
		var sequence int64
		if err := r.db.WithContext(ctx).Raw("SELECT nextval('ticket_reference_seq')").Scan(&sequence).Error; err != nil {
			return fmt.Errorf("generate ticket reference: %w", err)
		}
		ticketNumber, err := formatTicketNumber(sequence)
		if err != nil {
			return err
		}
		if err := r.db.WithContext(ctx).Model(&domain.Ticket{}).
			Where("id = ?", legacy.ID).
			Update("ticket_number", ticketNumber).Error; err != nil {
			return fmt.Errorf("migrate ticket reference %s: %w", legacy.ID, err)
		}
	}
	return nil
}

func formatTicketNumber(sequence int64) (string, error) {
	if sequence < 1 || sequence > maxShortTicketReference {
		return "", fmt.Errorf("ticket reference sequence %d exceeds the five-character limit", sequence)
	}
	code := strings.ToUpper(strconv.FormatInt(sequence, 36))
	if len(code) < 5 {
		code = strings.Repeat("0", 5-len(code)) + code
	}
	return "TCK-" + code, nil
}

func (r *TicketRepository) Create(ctx context.Context, ticket *domain.Ticket) error {
	if ticket == nil {
		return errors.New("ticket is nil")
	}
	if ticket.ID == uuid.Nil {
		ticket.ID = uuid.New()
	}
	if ticket.CreatedAt.IsZero() {
		ticket.CreatedAt = time.Now()
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if ticket.TicketNumber == "" {
			var sequence int64
			if err := tx.Raw("SELECT nextval('ticket_reference_seq')").Scan(&sequence).Error; err != nil {
				return fmt.Errorf("generate ticket reference: %w", err)
			}
			ticketNumber, err := formatTicketNumber(sequence)
			if err != nil {
				return err
			}
			ticket.TicketNumber = ticketNumber
		}
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		return tx.Create(&domain.TicketHistory{
			ID:        uuid.New(),
			TicketID:  ticket.ID,
			UserID:    ticket.CreatedByID,
			Action:    "CREATED",
			NewStatus: string(ticket.Status),
			Notes:     "Ticket créé.",
			IPAddress: ticket.AuditIPAddress,
			CreatedAt: ticket.CreatedAt,
		}).Error
	})
}

func (r *TicketRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Ticket, error) {
	var ticket domain.Ticket
	if err := r.db.WithContext(ctx).Preload("CreatedBy").Preload("AssignedTo").Preload("Attachments").First(&ticket, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

func (r *TicketRepository) GetAttachment(ctx context.Context, ticketID, attachmentID uuid.UUID) (*domain.TicketAttachment, error) {
	var attachment domain.TicketAttachment
	if err := r.db.WithContext(ctx).First(&attachment, "id = ? AND ticket_id = ?", attachmentID, ticketID).Error; err != nil {
		return nil, err
	}
	return &attachment, nil
}

func (r *TicketRepository) List(ctx context.Context, status *domain.TicketStatus, assignedTo *uuid.UUID, creatorID *uuid.UUID) ([]*domain.Ticket, error) {
	var tickets []*domain.Ticket
	query := r.db.WithContext(ctx).Model(&domain.Ticket{}).Preload("CreatedBy").Preload("AssignedTo")
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if assignedTo != nil {
		query = query.Where("assigned_to_id = ?", *assignedTo)
	}
	if creatorID != nil {
		query = query.Where("created_by_id = ?", *creatorID)
	}
	if err := query.Order("created_at DESC").Find(&tickets).Error; err != nil {
		return nil, err
	}
	return tickets, nil
}

func (r *TicketRepository) UpdateStatusWithAudit(ctx context.Context, ticketID uuid.UUID, newStatus domain.TicketStatus, authorID uuid.UUID, notes, ipAddress string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ticket domain.Ticket
		if err := tx.First(&ticket, "id = ?", ticketID).Error; err != nil {
			return err
		}
		oldStatus := string(ticket.Status)
		ticket.Status = newStatus
		now := time.Now()
		if newStatus == domain.StatusResolved {
			ticket.ResolvedAt = &now
		} else if newStatus == domain.StatusInProgress || newStatus == domain.StatusPending {
			ticket.ResolvedAt = nil
		}
		if newStatus == domain.StatusPending {
			ticket.AssignedToID = nil
		}
		ticket.UpdatedAt = now
		if err := tx.Save(&ticket).Error; err != nil {
			return err
		}
		return tx.Create(&domain.TicketHistory{
			ID:        uuid.New(),
			TicketID:  ticketID,
			UserID:    authorID,
			Action:    "STATUS_CHANGED",
			OldStatus: oldStatus,
			NewStatus: string(newStatus),
			Notes:     notes,
			IPAddress: ipAddress,
			CreatedAt: now,
		}).Error
	})
}

func (r *TicketRepository) Assign(ctx context.Context, ticketID, techID, authorID uuid.UUID, ipAddress string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var technician domain.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&technician, "id = ?", techID).Error; err != nil {
			return err
		}
		if !technician.IsActive || technician.Role != domain.RoleTechnician {
			return domain.ErrUnauthorized
		}
		var activeCount int64
		if err := tx.Model(&domain.Ticket{}).
			Where("assigned_to_id = ? AND status IN ?", techID, []domain.TicketStatus{domain.StatusAssigned, domain.StatusInProgress}).
			Where("id <> ?", ticketID).Count(&activeCount).Error; err != nil {
			return err
		}
		if activeCount > 0 {
			return domain.ErrTechnicianBusy
		}
		var ticket domain.Ticket
		if err := tx.First(&ticket, "id = ?", ticketID).Error; err != nil {
			return err
		}
		oldStatus := ticket.Status
		ticket.AssignedToID = &techID
		ticket.Status = domain.StatusAssigned
		ticket.UpdatedAt = time.Now()
		if err := tx.Save(&ticket).Error; err != nil {
			return err
		}
		return tx.Create(&domain.TicketHistory{
			ID:        uuid.New(),
			TicketID:  ticketID,
			UserID:    authorID,
			Action:    "ASSIGNED",
			OldStatus: string(oldStatus),
			NewStatus: string(ticket.Status),
			IPAddress: ipAddress,
			CreatedAt: time.Now(),
		}).Error
	})
}

func (r *TicketRepository) Take(ctx context.Context, ticketID, techID uuid.UUID, ipAddress string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var technician domain.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&technician, "id = ?", techID).Error; err != nil {
			return err
		}
		if !technician.IsActive || technician.Role != domain.RoleTechnician {
			return domain.ErrUnauthorized
		}
		var activeCount int64
		if err := tx.Model(&domain.Ticket{}).
			Where("assigned_to_id = ? AND status IN ?", techID, []domain.TicketStatus{domain.StatusAssigned, domain.StatusInProgress}).
			Count(&activeCount).Error; err != nil {
			return err
		}
		if activeCount > 0 {
			return domain.ErrTechnicianBusy
		}
		var nextTicket domain.Ticket
		if err := tx.Where("status = ? AND assigned_to_id IS NULL", domain.StatusPending).
			Order("CASE priority WHEN 'URGENT' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC").
			Order("created_at ASC, ticket_number ASC").
			First(&nextTicket).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domain.ErrTicketNotNextInQueue
			}
			return err
		}
		if nextTicket.ID != ticketID {
			return domain.ErrTicketNotNextInQueue
		}
		var ticket domain.Ticket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ticket, "id = ?", ticketID).Error; err != nil {
			return err
		}
		if ticket.Status != domain.StatusPending || ticket.AssignedToID != nil {
			return domain.ErrInvalidStatusChange
		}
		ticket.AssignedToID = &techID
		ticket.Status = domain.StatusInProgress
		ticket.UpdatedAt = time.Now()
		if err := tx.Save(&ticket).Error; err != nil {
			return err
		}
		return tx.Create(&domain.TicketHistory{
			ID:        uuid.New(),
			TicketID:  ticketID,
			UserID:    techID,
			Action:    "TAKEN",
			OldStatus: string(domain.StatusPending),
			NewStatus: string(domain.StatusInProgress),
			Notes:     "Ticket pris en charge.",
			IPAddress: ipAddress,
			CreatedAt: time.Now(),
		}).Error
	})
}

func (r *TicketRepository) Reopen(ctx context.Context, ticketID, authorID uuid.UUID, notes, ipAddress string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ticket domain.Ticket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ticket, "id = ?", ticketID).Error; err != nil {
			return err
		}
		if ticket.Status != domain.StatusResolved && ticket.Status != domain.StatusClosed {
			return domain.ErrInvalidStatusChange
		}
		oldStatus := ticket.Status
		now := time.Now()
		ticket.Status = domain.StatusPending
		ticket.Priority = domain.PriorityUrgent
		ticket.AssignedToID = nil
		ticket.ResolvedAt = nil
		var policy domain.SLAPolicy
		if err := tx.First(&policy, "priority = ?", domain.PriorityUrgent).Error; err != nil {
			return fmt.Errorf("load urgent SLA policy for reopened ticket: %w", err)
		}
		ticket.SLADeadline = now.Add(time.Duration(policy.MaxHours * float64(time.Hour)))
		ticket.UpdatedAt = now
		if err := tx.Save(&ticket).Error; err != nil {
			return err
		}
		if err := tx.Create(&domain.TicketHistory{
			ID: uuid.New(), TicketID: ticketID, UserID: authorID,
			Action: "STATUS_CHANGED", OldStatus: string(oldStatus), NewStatus: string(domain.StatusPending),
			Notes: notes, IPAddress: ipAddress, CreatedAt: now,
		}).Error; err != nil {
			return err
		}
		return tx.Create(&domain.TicketComment{
			ID: uuid.New(), TicketID: ticketID, UserID: authorID,
			Content: notes, CreatedAt: now,
		}).Error
	})
}

func (r *TicketRepository) Delete(ctx context.Context, ticketID uuid.UUID) error {
	result := r.db.WithContext(ctx).Delete(&domain.Ticket{}, "id = ?", ticketID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *TicketRepository) AddComment(ctx context.Context, comment *domain.TicketComment) error {
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

func (r *TicketRepository) GetHistory(ctx context.Context, ticketID uuid.UUID) ([]*domain.TicketHistory, error) {
	var history []*domain.TicketHistory
	if err := r.db.WithContext(ctx).Where("ticket_id = ?", ticketID).Order("created_at ASC").Preload("User").Find(&history).Error; err != nil {
		return nil, err
	}
	return history, nil
}

func (r *TicketRepository) GetComments(ctx context.Context, ticketID uuid.UUID) ([]*domain.TicketComment, error) {
	var comments []*domain.TicketComment
	if err := r.db.WithContext(ctx).Where("ticket_id = ?", ticketID).Order("created_at ASC").Preload("User").Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}
