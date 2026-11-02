package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByIdentifier(ctx context.Context, identifier string) (*User, error)
	List(ctx context.Context) ([]*User, error)
	UpdateProfile(ctx context.Context, id uuid.UUID, fullName, email string) error
	UpdatePasswordHash(ctx context.Context, id uuid.UUID, passwordHash string) error
	UpdateLastSeen(ctx context.Context, id uuid.UUID, ipAddress string, seenAt time.Time) error
	SetPasswordResetCode(ctx context.Context, id uuid.UUID, codeHash string, expiresAt, requestedAt time.Time) error
	ClearPasswordResetCode(ctx context.Context, id uuid.UUID, codeHash string) error
	CompletePasswordReset(ctx context.Context, email, codeHash, passwordHash string, now time.Time) error
	UpdateRole(ctx context.Context, id uuid.UUID, role UserRole) error
	UpdateDepartment(ctx context.Context, id uuid.UUID, department string) error
	ToggleActive(ctx context.Context, id uuid.UUID) error
}

type TicketRepository interface {
	Create(ctx context.Context, ticket *Ticket) error
	GetByID(ctx context.Context, id uuid.UUID) (*Ticket, error)
	List(ctx context.Context, status *TicketStatus, assignedTo *uuid.UUID, creatorID *uuid.UUID) ([]*Ticket, error)
	UpdateStatusWithAudit(ctx context.Context, ticketID uuid.UUID, newStatus TicketStatus, authorID uuid.UUID, notes, ipAddress string) error
	Reopen(ctx context.Context, ticketID, authorID uuid.UUID, notes, ipAddress string) error
	Assign(ctx context.Context, ticketID, techID, authorID uuid.UUID, ipAddress string) error
	Take(ctx context.Context, ticketID, techID uuid.UUID, ipAddress string) error
	Delete(ctx context.Context, ticketID uuid.UUID) error
	AddComment(ctx context.Context, comment *TicketComment) error
	GetHistory(ctx context.Context, ticketID uuid.UUID) ([]*TicketHistory, error)
	GetComments(ctx context.Context, ticketID uuid.UUID) ([]*TicketComment, error)
	GetAttachment(ctx context.Context, ticketID, attachmentID uuid.UUID) (*TicketAttachment, error)
}

type SLARepository interface {
	List(ctx context.Context) ([]*SLAPolicy, error)
	Get(ctx context.Context, priority TicketPriority) (*SLAPolicy, error)
	Upsert(ctx context.Context, policy *SLAPolicy) error
}

type DepartmentRepository interface {
	List(ctx context.Context) ([]*Department, error)
	Create(ctx context.Context, department *Department) error
	Rename(ctx context.Context, oldName, newName string) error
	Delete(ctx context.Context, name string) error
}
