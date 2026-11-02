package service

import (
	"context"
	"fmt"
	"strings"

	"deskflow/internal/domain"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AdminService struct {
	userRepo       domain.UserRepository
	ticketRepo     domain.TicketRepository
	slaRepo        domain.SLARepository
	departmentRepo domain.DepartmentRepository
}

func NewAdminService(userRepo domain.UserRepository, ticketRepo domain.TicketRepository, slaRepo domain.SLARepository, departmentRepos ...domain.DepartmentRepository) *AdminService {
	var departmentRepo domain.DepartmentRepository
	if len(departmentRepos) > 0 {
		departmentRepo = departmentRepos[0]
	}
	return &AdminService{
		userRepo:       userRepo,
		ticketRepo:     ticketRepo,
		slaRepo:        slaRepo,
		departmentRepo: departmentRepo,
	}
}

func (s *AdminService) ListDepartments(ctx context.Context) ([]*domain.Department, error) {
	if s.departmentRepo == nil {
		return nil, fmt.Errorf("repository des départements non configuré")
	}
	return s.departmentRepo.List(ctx)
}

func (s *AdminService) CreateDepartment(ctx context.Context, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 100 {
		return fmt.Errorf("%w: nom de département requis (100 caractères maximum)", domain.ErrInvalidInput)
	}
	if s.departmentRepo == nil {
		return fmt.Errorf("repository des départements non configuré")
	}
	return s.departmentRepo.Create(ctx, &domain.Department{Name: name})
}

func (s *AdminService) RenameDepartment(ctx context.Context, oldName, newName string) error {
	oldName, newName = strings.TrimSpace(oldName), strings.TrimSpace(newName)
	if oldName == "" || newName == "" || len(newName) > 100 {
		return fmt.Errorf("%w: nom de département invalide", domain.ErrInvalidInput)
	}
	if oldName == newName {
		return nil
	}
	if s.departmentRepo == nil {
		return fmt.Errorf("repository des départements non configuré")
	}
	return s.departmentRepo.Rename(ctx, oldName, newName)
}

func (s *AdminService) DeleteDepartment(ctx context.Context, name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("%w: nom de département requis", domain.ErrInvalidInput)
	}
	if s.departmentRepo == nil {
		return fmt.Errorf("repository des départements non configuré")
	}
	return s.departmentRepo.Delete(ctx, strings.TrimSpace(name))
}

func (s *AdminService) GetDashboardMetrics(ctx context.Context) (map[string]interface{}, error) {
	users, err := s.userRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	tickets, err := s.ticketRepo.List(ctx, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"users":       len(users),
		"tickets":     len(tickets),
		"pending":     0,
		"in_progress": 0,
		"resolved":    0,
	}

	for _, ticket := range tickets {
		switch ticket.Status {
		case domain.StatusPending:
			stats["pending"] = stats["pending"].(int) + 1
		case domain.StatusInProgress:
			stats["in_progress"] = stats["in_progress"].(int) + 1
		case domain.StatusResolved:
			stats["resolved"] = stats["resolved"].(int) + 1
		}
	}

	return stats, nil
}

func (s *AdminService) ListAllUsers(ctx context.Context) ([]*domain.User, error) {
	return s.userRepo.List(ctx)
}

func (s *AdminService) SetUserPassword(ctx context.Context, userID uuid.UUID, password string) error {
	password = strings.TrimSpace(password)
	if len(password) < 8 {
		return fmt.Errorf("%w: le mot de passe doit comporter au moins 8 caractères", domain.ErrInvalidInput)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash user password: %w", err)
	}
	return s.userRepo.UpdatePasswordHash(ctx, userID, string(hash))
}

func (s *AdminService) GetUser(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}

func (s *AdminService) ChangeUserRole(ctx context.Context, userID uuid.UUID, role domain.UserRole) error {
	switch role {
	case domain.RoleAdmin, domain.RoleChefDeSupport, domain.RoleTechnician, domain.RoleChefDeService, domain.RoleUser:
	default:
		return fmt.Errorf("rôle invalide")
	}
	return s.userRepo.UpdateRole(ctx, userID, role)
}

func (s *AdminService) UpdateUserDepartment(ctx context.Context, userID uuid.UUID, department string) error {
	department = strings.TrimSpace(department)
	if department == "" {
		return fmt.Errorf("département requis")
	}
	return s.userRepo.UpdateDepartment(ctx, userID, department)
}

func (s *AdminService) ToggleUserActive(ctx context.Context, userID uuid.UUID) error {
	return s.userRepo.ToggleActive(ctx, userID)
}

func (s *AdminService) ListSLAPolicies(ctx context.Context) ([]*domain.SLAPolicy, error) {
	return s.slaRepo.List(ctx)
}

func (s *AdminService) UpdateSLAPolicy(ctx context.Context, policy *domain.SLAPolicy) error {
	switch policy.Priority {
	case domain.PriorityUrgent, domain.PriorityHigh, domain.PriorityMedium, domain.PriorityLow:
	default:
		return fmt.Errorf("priorité invalide")
	}
	if policy.MaxHours <= 0 || policy.MaxHours > 8760 {
		return fmt.Errorf("la durée SLA doit être comprise entre 0 et 8760 heures")
	}
	return s.slaRepo.Upsert(ctx, policy)
}

func (s *AdminService) ListAuditLogs(ctx context.Context) ([]*domain.AuditLogEntry, error) {
	tickets, err := s.ticketRepo.List(ctx, nil, nil, nil)
	if err != nil {
		return nil, err
	}
	entries := make([]*domain.AuditLogEntry, 0)
	for _, ticket := range tickets {
		history, err := s.ticketRepo.GetHistory(ctx, ticket.ID)
		if err != nil {
			return nil, err
		}
		for _, event := range history {
			userName := ""
			var role domain.UserRole
			if event.User != nil {
				userName = event.User.FullName
				role = event.User.Role
			}
			details := event.Notes
			if details == "" {
				details = string(event.OldStatus) + " -> " + string(event.NewStatus)
			}
			entries = append(entries, &domain.AuditLogEntry{
				ID:         event.ID.String(),
				Timestamp:  event.CreatedAt,
				UserID:     event.UserID.String(),
				UserName:   userName,
				UserRole:   role,
				Action:     event.Action,
				TargetType: "TICKET",
				TargetID:   ticket.ID.String(),
				Details:    details,
				IPAddress:  event.IPAddress,
			})
		}
	}
	return entries, nil
}
