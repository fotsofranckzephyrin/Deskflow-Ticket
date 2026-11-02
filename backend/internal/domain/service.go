package domain

import (
	"context"

	"github.com/google/uuid"
)

type EmailSender interface {
	Send(to, subject, body string) error
}

type AuthService interface {
	Register(ctx context.Context, fullName, email, password, department, matricule string, role UserRole) (*User, string, error)
	Login(ctx context.Context, identifier, password string) (*User, string, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, fullName, email string) (*User, error)
	ValidateToken(tokenString string) (uuid.UUID, UserRole, error)
	RequestPasswordReset(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, email, code, newPassword string) error
}

type TicketService interface {
	CreateTicket(ctx context.Context, title, description, category string, estimatedCost float64, authorID uuid.UUID, ipAddress string) (*Ticket, error)
	CreateTicketWithAttachments(ctx context.Context, title, description, category string, estimatedCost float64, authorID uuid.UUID, ipAddress string, attachments []TicketAttachment, requestLanguage []string, requestUTCOffset ...int) (*Ticket, error)
	GetCategorySLA(ctx context.Context, category string, authorID uuid.UUID) (*SLAPolicy, error)
	GetTicket(ctx context.Context, id uuid.UUID) (*Ticket, []*TicketComment, []*TicketHistory, error)
	ListTickets(ctx context.Context, user *User, status *TicketStatus) ([]*Ticket, error)
	ChangeStatus(ctx context.Context, ticketID uuid.UUID, newStatus TicketStatus, authorID uuid.UUID, notes, ipAddress string) error
	AssignTicket(ctx context.Context, ticketID, techID, adminID uuid.UUID, ipAddress string) error
	TakeTicket(ctx context.Context, ticketID, technicianID uuid.UUID, ipAddress string) error
	DeleteTicket(ctx context.Context, ticketID, authorID uuid.UUID) error
	AddComment(ctx context.Context, ticketID, authorID uuid.UUID, content string) (*TicketComment, error)
	GetTicketAttachment(ctx context.Context, ticketID, attachmentID uuid.UUID) (*TicketAttachment, error)
}

type AdminService interface {
	GetDashboardMetrics(ctx context.Context) (map[string]interface{}, error)
	GetUser(ctx context.Context, userID uuid.UUID) (*User, error)
	ListAllUsers(ctx context.Context) ([]*User, error)
	SetUserPassword(ctx context.Context, userID uuid.UUID, password string) error
	ChangeUserRole(ctx context.Context, userID uuid.UUID, role UserRole) error
	UpdateUserDepartment(ctx context.Context, userID uuid.UUID, department string) error
	ToggleUserActive(ctx context.Context, userID uuid.UUID) error
	ListSLAPolicies(ctx context.Context) ([]*SLAPolicy, error)
	UpdateSLAPolicy(ctx context.Context, policy *SLAPolicy) error
	ListAuditLogs(ctx context.Context) ([]*AuditLogEntry, error)
	ListDepartments(ctx context.Context) ([]*Department, error)
	CreateDepartment(ctx context.Context, name string) error
	RenameDepartment(ctx context.Context, oldName, newName string) error
	DeleteDepartment(ctx context.Context, name string) error
}
