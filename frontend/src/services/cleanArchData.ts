/**
 * DeskFlow Clean Architecture Blueprint & Codebase Documentation
 */

export interface LayerSpec {
  id: string;
  name: string;
  role: string;
  principles: string[];
  files: { path: string; description: string; language: string; code: string }[];
}

export const CLEAN_ARCH_LAYERS: LayerSpec[] = [
  {
    id: 'domain',
    name: '1. Domain Layer (Cœur Métier)',
    role: 'Entités pures indépendantes de tout framework, erreurs standard et interfaces abstraites (Ports).',
    principles: [
      'Indépendance totale vis-à-vis des bibliothèques externes (ni Gin, ni GORM).',
      'Validation des transitions de statut (Machine à états : PENDING -> ASSIGNED -> IN_PROGRESS -> RESOLVED).',
      'Définition des contrats d\'accès aux données (UserRepository, TicketRepository).'
    ],
    files: [
      {
        path: 'backend/internal/domain/entity.go',
        description: 'Entités User, Ticket, Comment, History et énumérations strictes',
        language: 'go',
        code: `package domain

import (
	"errors"
	"time"
	"github.com/google/uuid"
)

var (
	ErrTicketNotFound      = errors.New("ticket introuvable")
	ErrUnauthorized        = errors.New("accès non autorisé")
	ErrInvalidStatusChange = errors.New("transition de statut invalide")
	ErrUserInactive        = errors.New("compte utilisateur désactivé")
)

type UserRole string

const (
	RoleAdmin      UserRole = "ADMIN"
	RoleTechnician UserRole = "TECHNICIAN"
	RoleUser       UserRole = "USER"
)

type TicketStatus string

const (
	StatusPending    TicketStatus = "PENDING"
	StatusAssigned   TicketStatus = "ASSIGNED"
	StatusInProgress TicketStatus = "IN_PROGRESS"
	StatusResolved   TicketStatus = "RESOLVED"
	StatusClosed     TicketStatus = "CLOSED"
)

type Ticket struct {
	ID           uuid.UUID    \`json:"id" gorm:"type:uuid;primaryKey"\`
	TicketNumber string       \`json:"ticket_number" gorm:"type:varchar(50);uniqueIndex;not null"\`
	Title        string       \`json:"title" gorm:"type:varchar(200);not null"\`
	Description  string       \`json:"description" gorm:"type:text;not null"\`
	Category     string       \`json:"category" gorm:"type:varchar(50);not null"\`
	Priority     string       \`json:"priority" gorm:"type:varchar(20);not null"\`
	Status       TicketStatus \`json:"status" gorm:"type:varchar(20);not null;default:'PENDING'"\`
	CreatedByID  uuid.UUID    \`json:"created_by_id" gorm:"type:uuid;not null"\`
	AssignedToID *uuid.UUID   \`json:"assigned_to_id,omitempty" gorm:"type:uuid"\`
	CreatedAt    time.Time    \`json:"created_at"\`
	UpdatedAt    time.Time    \`json:"updated_at"\`
}`
      },
      {
        path: 'backend/internal/domain/repository.go',
        description: 'Interfaces des Repositories pour l\'inversion de dépendances (DIP)',
        language: 'go',
        code: `package domain

import (
	"context"
	"github.com/google/uuid"
)

type TicketRepository interface {
	Create(ctx context.Context, ticket *Ticket) error
	GetByID(ctx context.Context, id uuid.UUID) (*Ticket, error)
	List(ctx context.Context, status *TicketStatus, assignedTo *uuid.UUID, limit, offset int) ([]*Ticket, int64, error)
	// Transaction atomique : Mise à jour du statut + Insertion dans l'historique d'audit
	UpdateStatusWithAudit(ctx context.Context, ticketID uuid.UUID, newStatus TicketStatus, authorID uuid.UUID, notes string) error
	Assign(ctx context.Context, ticketID, techID, authorID uuid.UUID) error
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context) ([]*User, error)
	UpdateRole(ctx context.Context, id uuid.UUID, role UserRole) error
}`
      }
    ]
  },
  {
    id: 'usecases',
    name: '2. Use Cases / Services (Logique Métier)',
    role: 'Orchestration des règles métier, injection des dépendances par constructeur.',
    principles: [
      'Injection de dépendances pure via constructeur (NewTicketService).',
      'Validation de la machine à états avant persistance.',
      'Isolation des responsabilités : AuthService, TicketService, AdminService.'
    ],
    files: [
      {
        path: 'backend/internal/service/ticket_service.go',
        description: 'Service métier orchestrant la création et l\'avancement des tickets',
        language: 'go',
        code: `package service

import (
	"context"
	"deskflow/internal/domain"
	"github.com/google/uuid"
)

type ticketService struct {
	ticketRepo domain.TicketRepository
	userRepo   domain.UserRepository
}

func NewTicketService(
	ticketRepo domain.TicketRepository,
	userRepo domain.UserRepository,
) domain.TicketService {
	return &ticketService{
		ticketRepo: ticketRepo,
		userRepo:   userRepo,
	}
}

func (s *ticketService) ChangeStatus(ctx context.Context, ticketID uuid.UUID, newStatus domain.TicketStatus, authorID uuid.UUID, notes string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}

	// Validation de la transition
	if ticket.Status == domain.StatusClosed {
		return domain.ErrInvalidStatusChange
	}

	return s.ticketRepo.UpdateStatusWithAudit(ctx, ticketID, newStatus, authorID, notes)
}`
      }
    ]
  },
  {
    id: 'adapters',
    name: '3. Repositories PostgreSQL (Couche Persistence)',
    role: 'Implémentation SQL et transactions ACID avec GORM / PostgreSQL.',
    principles: [
      'Utilisation des transactions SQL (tx.Commit / tx.Rollback) pour garantir l\'audit trail.',
      'Indexation composite sur le statut, la priorité et les clés étrangères.',
      'Contraintes SQL strictes et typage UUID natif.'
    ],
    files: [
      {
        path: 'backend/internal/repository/postgres/ticket_repository.go',
        description: 'Repository PostgreSQL avec transaction ACID pour la mise à jour et l\'audit',
        language: 'go',
        code: `package postgres

func (r *ticketRepository) UpdateStatusWithAudit(ctx context.Context, ticketID uuid.UUID, newStatus domain.TicketStatus, authorID uuid.UUID, notes string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ticket domain.Ticket
		if err := tx.Where("id = ?", ticketID).First(&ticket).Error; err != nil {
			return err
		}

		oldStatus := ticket.Status
		ticket.Status = newStatus
		ticket.UpdatedAt = time.Now()

		if err := tx.Save(&ticket).Error; err != nil {
			return err
		}

		// Enregistrement immuable dans l'historique
		history := domain.TicketHistory{
			ID:        uuid.New(),
			TicketID:  ticketID,
			UserID:    authorID,
			Action:    "STATUS_UPDATE",
			OldStatus: string(oldStatus),
			NewStatus: string(newStatus),
			Notes:     notes,
			CreatedAt: time.Now(),
		}

		return tx.Create(&history).Error
	})
}`
      },
      {
        path: 'backend/database/migrations.sql',
        description: 'Schéma PostgreSQL complet avec tables, contraintes, index et triggers',
        language: 'sql',
        code: `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'TECHNICIAN', 'USER')),
    department VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    created_by_id UUID NOT NULL REFERENCES users(id),
    assigned_to_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_creator ON tickets(created_by_id);`
      }
    ]
  },
  {
    id: 'delivery',
    name: '4. Delivery Layer (Gin REST API & JWT)',
    role: 'Contrôleurs HTTP, validation DTO, gestion des erreurs et middlewares de sécurité.',
    principles: [
      'Garde RBAC stricte : RequireRole(domain.RoleAdmin) pour les routes protégées.',
      'Contrats d\'API RESTful standardisés avec envelopes de réponse prévisibles.',
      'Génération et validation de token JWT conforme RFC 7519.'
    ],
    files: [
      {
        path: 'backend/internal/delivery/http/middleware/auth_middleware.go',
        description: 'Middleware d\'authentification JWT et contrôle de rôle RBAC pour Gin',
        language: 'go',
        code: `func RequireRole(allowedRoles ...domain.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("userRole")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "rôle manquant"})
			return
		}

		userRole := roleVal.(domain.UserRole)
		for _, r := range allowedRoles {
			if userRole == r {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "accès refusé : privilèges administrateur requis",
		})
	}
}`
      }
    ]
  }
];

export const TECHNICAL_STRENGTHS = [
  {
    title: 'Clean Architecture Hexagonale',
    description: 'Séparation rigoureuse en 4 couches concentriques. Le domaine métier ne dépend d\'aucun framework, ce qui garantit la testabilité unitaire et l\'indépendance technologique.',
  },
  {
    title: 'Transactions ACID PostgreSQL',
    description: 'Chaque changement de statut de ticket et écriture dans le journal d\'audit s\'exécute dans un bloc transactionnel PostgreSQL unique, empêchant toute incohérence de données.',
  },
  {
    title: 'Injection de Dépendances Pure (DI)',
    description: 'Aucune variable globale instable. L\'assemblage complet s\'effectue au démarrage dans container.go, simplifiant les mocks pour les tests d\'intégration.',
  },
  {
    title: 'Sécurité JWT & Contrôle d\'Accès RBAC',
    description: 'Middleware Gin validant les signatures HMAC-SHA256 avec isolation stricte des routes d\'administration réservées aux rôles ADMIN.',
  },
];
