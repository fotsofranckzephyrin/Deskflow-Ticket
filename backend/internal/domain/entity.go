package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrTicketNotFound        = errors.New("ticket introuvable")
	ErrUserNotFound          = errors.New("utilisateur introuvable")
	ErrUnauthorized          = errors.New("accès non autorisé : privilèges insuffisants")
	ErrInvalidCredentials    = errors.New("identifiants invalides")
	ErrInvalidStatusChange   = errors.New("transition d'état de ticket invalide")
	ErrUserInactive          = errors.New("compte utilisateur inactif")
	ErrInvalidInput          = errors.New("données invalides")
	ErrIdentityConflict      = errors.New("adresse e-mail ou matricule déjà utilisé")
	ErrPasswordResetCooldown = errors.New("la réinitialisation du mot de passe est limitée à une demande tous les 30 jours")
	ErrPasswordResetInvalid  = errors.New("code de réinitialisation invalide ou expiré")
	ErrTechnicianBusy        = errors.New("ce technicien traite déjà une demande non résolue")
	ErrTicketNotNextInQueue  = errors.New("vous devez prendre la demande prioritaire la plus ancienne de la file")
	ErrDepartmentInUse       = errors.New("ce département est encore utilisé par des comptes ou des demandes")
	ErrDepartmentExists      = errors.New("ce département existe déjà")
)

type UserRole string

const (
	RoleAdmin         UserRole = "ADMIN"
	RoleChefDeSupport UserRole = "CHEF_DE_SUPPORT"
	RoleTechnician    UserRole = "TECHNICIAN"
	RoleChefDeService UserRole = "CHEF_DE_SERVICE"
	RoleUser          UserRole = "USER"
)

type User struct {
	ID                       uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	FullName                 string     `json:"full_name" gorm:"type:varchar(100);not null"`
	Email                    string     `json:"email" gorm:"type:varchar(150);unique;not null"`
	Matricule                string     `json:"matricule" gorm:"type:varchar(50);unique"`
	PasswordHash             string     `json:"-" gorm:"type:varchar(255);not null"`
	Role                     UserRole   `json:"role" gorm:"type:varchar(20);not null;default:'USER'"`
	Department               string     `json:"department" gorm:"type:varchar(100);not null"`
	IsActive                 bool       `json:"is_active" gorm:"default:true;not null"`
	LastIPAddress            string     `json:"-" gorm:"type:varchar(45)"`
	LastSeenAt               *time.Time `json:"-"`
	PasswordResetRequestedAt *time.Time `json:"-"`
	PasswordResetCodeHash    string     `json:"-" gorm:"type:varchar(64);not null;default:''"`
	PasswordResetExpiresAt   *time.Time `json:"-"`
	PasswordResetAttempts    int        `json:"-" gorm:"not null;default:0"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`
}

type Department struct {
	Name string `json:"name" gorm:"type:varchar(100);primaryKey"`
}

type TicketStatus string

const (
	StatusPendingApproval TicketStatus = "PENDING_APPROVAL"
	StatusPending         TicketStatus = "PENDING"
	StatusAssigned        TicketStatus = "ASSIGNED"
	StatusInProgress      TicketStatus = "IN_PROGRESS"
	StatusResolved        TicketStatus = "RESOLVED"
	StatusClosed          TicketStatus = "CLOSED"
	StatusRejected        TicketStatus = "REJECTED"
)

type TicketPriority string

const (
	PriorityLow    TicketPriority = "LOW"
	PriorityMedium TicketPriority = "MEDIUM"
	PriorityHigh   TicketPriority = "HIGH"
	PriorityUrgent TicketPriority = "URGENT"
)

type Ticket struct {
	ID               uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey"`
	TicketNumber     string         `json:"ticket_number" gorm:"type:varchar(64);unique;not null"`
	Title            string         `json:"title" gorm:"type:varchar(200);not null"`
	Description      string         `json:"description" gorm:"type:text;not null"`
	Category         string         `json:"category" gorm:"type:varchar(50);not null"`
	RequestLanguage  string         `json:"request_language" gorm:"type:varchar(2);not null;default:'fr'"`
	RequestUTCOffset int            `json:"-" gorm:"not null;default:0"`
	Priority         TicketPriority `json:"priority" gorm:"type:varchar(20);not null"`
	Status           TicketStatus   `json:"status" gorm:"type:varchar(20);not null;default:'PENDING'"`
	CreatedByID      uuid.UUID      `json:"created_by_id" gorm:"type:uuid;not null"`
	AssignedToID     *uuid.UUID     `json:"assigned_to_id,omitempty" gorm:"type:uuid"`
	Department       string         `json:"department" gorm:"type:varchar(100);not null"`
	EstimatedCost    float64        `json:"estimated_cost" gorm:"not null;default:0"`
	RequiresApproval bool           `json:"requires_approval" gorm:"not null;default:false"`
	ApprovalNotes    string         `json:"approval_notes" gorm:"type:text"`
	SLADeadline      time.Time      `json:"sla_deadline" gorm:"not null;default:now()"`
	ResolvedAt       *time.Time     `json:"resolved_at,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	AuditIPAddress   string         `json:"-" gorm:"-"`

	CreatedBy   *User              `json:"created_by,omitempty" gorm:"foreignKey:CreatedByID"`
	AssignedTo  *User              `json:"assigned_to,omitempty" gorm:"foreignKey:AssignedToID"`
	Attachments []TicketAttachment `json:"attachments,omitempty" gorm:"foreignKey:TicketID;constraint:OnDelete:CASCADE"`
}

type TicketAttachment struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	TicketID    uuid.UUID `json:"ticket_id" gorm:"type:uuid;not null;index"`
	FileName    string    `json:"file_name" gorm:"type:varchar(255);not null"`
	ContentType string    `json:"content_type" gorm:"type:varchar(100);not null"`
	Size        int64     `json:"size" gorm:"not null"`
	Data        []byte    `json:"-" gorm:"type:bytea;not null"`
	CreatedAt   time.Time `json:"created_at"`
}

type TicketComment struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	TicketID  uuid.UUID `json:"ticket_id" gorm:"type:uuid;not null;index"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at"`

	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type TicketHistory struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	TicketID  uuid.UUID `json:"ticket_id" gorm:"type:uuid;not null;index"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	Action    string    `json:"action" gorm:"type:varchar(100);not null"`
	OldStatus string    `json:"old_status,omitempty" gorm:"type:varchar(20)"`
	NewStatus string    `json:"new_status,omitempty" gorm:"type:varchar(20)"`
	Notes     string    `json:"notes" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	IPAddress string    `json:"-" gorm:"type:varchar(45)"`

	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type SLAPolicy struct {
	Priority    TicketPriority `json:"priority" gorm:"type:varchar(20);primaryKey"`
	MaxHours    float64        `json:"max_hours" gorm:"not null"`
	Description string         `json:"description" gorm:"type:text;not null"`
}

type AuditLogEntry struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	UserRole   UserRole  `json:"user_role"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Details    string    `json:"details"`
	IPAddress  string    `json:"ip_address"`
}
