package container

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	delivery "deskflow/internal/delivery/http"
	"deskflow/internal/domain"
	"deskflow/internal/repository/postgres"
	"deskflow/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	pgDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Container struct {
	DB     *gorm.DB
	Router *gin.Engine
}

func initializeDepartments(repo domain.DepartmentRepository) error {
	names := []string{
		"Direction des Systèmes d'Information (DSI)",
		"Direction Financière & Comptabilité",
		"Direction des Ressources Humaines",
		"Direction Commerciale & Marketing",
		"Direction des Opérations & Logistique",
		"Support & Infrastructure IT",
		"Direction Juridique & Conformité",
		"Direction Audit & Contrôle de Gestion",
	}
	for _, name := range names {
		err := repo.Create(context.Background(), &domain.Department{Name: name})
		if errors.Is(err, domain.ErrDepartmentExists) {
			continue
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func NewContainer() (*Container, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be configured with at least 32 characters")
	}
	adminEmail := strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminEmail == "" || len(adminPassword) < 12 {
		return nil, fmt.Errorf("ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) are required")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"),
			getEnv("DB_USER", "deskflow"),
			getEnv("DB_PASSWORD", ""),
			getEnv("DB_NAME", "deskflow"),
			getEnv("DB_PORT", "5432"),
		)
	}

	db, err := gorm.Open(
		pgDriver.Open(dsn),
		&gorm.Config{TranslateError: true},
	)
	if err != nil {
		return nil, fmt.Errorf("database connection failed: %w", err)
	}
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Ticket{},
		&domain.TicketAttachment{},
		&domain.TicketComment{},
		&domain.TicketHistory{},
		&domain.SLAPolicy{},
		&domain.Department{},
	); err != nil {
		return nil, fmt.Errorf("database migration failed: %w", err)
	}
	userRepo := postgres.NewUserRepository(db)
	ticketRepo := postgres.NewTicketRepository(db)
	if err := ticketRepo.EnsureShortReferences(context.Background()); err != nil {
		return nil, fmt.Errorf("migrate ticket references: %w", err)
	}
	slaRepo := postgres.NewSLARepository(db)
	departmentRepo := postgres.NewDepartmentRepository(db)
	if err := initializeDepartments(departmentRepo); err != nil {
		return nil, fmt.Errorf("initialize departments: %w", err)
	}
	if err := initializeSLAPolicies(slaRepo); err != nil {
		return nil, fmt.Errorf("initialize SLA policies: %w", err)
	}
	if err := ensureInitialAdmin(userRepo, adminEmail, adminPassword); err != nil {
		return nil, fmt.Errorf("initialize administrator: %w", err)
	}
	if err := synchronizeExistingDepartments(departmentRepo, userRepo, ticketRepo); err != nil {
		return nil, fmt.Errorf("synchronize existing departments: %w", err)
	}

	emailSender := service.NewSMTPEmailSender()
	authService := service.NewAuthService(userRepo, jwtSecret, emailSender)
	ticketService := service.NewTicketService(ticketRepo, userRepo, slaRepo, emailSender)
	adminService := service.NewAdminService(userRepo, ticketRepo, slaRepo, departmentRepo)

	router := delivery.SetupRouter(delivery.RouterDependencies{
		UserRepository: userRepo,
		AuthService:    authService,
		TicketService:  ticketService,
		AdminService:   adminService,
	})

	return &Container{DB: db, Router: router}, nil
}

func synchronizeExistingDepartments(
	departmentRepo domain.DepartmentRepository,
	userRepo domain.UserRepository,
	ticketRepo domain.TicketRepository,
) error {
	users, err := userRepo.List(context.Background())
	if err != nil {
		return err
	}
	tickets, err := ticketRepo.List(context.Background(), nil, nil, nil)
	if err != nil {
		return err
	}
	names := make([]string, 0, len(users)+len(tickets))
	for _, user := range users {
		names = append(names, user.Department)
	}
	for _, ticket := range tickets {
		names = append(names, ticket.Department)
	}
	for _, name := range names {
		if strings.TrimSpace(name) == "" {
			continue
		}
		err := departmentRepo.Create(context.Background(), &domain.Department{Name: name})
		if errors.Is(err, domain.ErrDepartmentExists) {
			continue
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func initializeSLAPolicies(repo domain.SLARepository) error {
	policies := []domain.SLAPolicy{
		{Priority: domain.PriorityUrgent, MaxHours: 2, Description: "Interruption critique"},
		{Priority: domain.PriorityHigh, MaxHours: 8, Description: "Gêne opérationnelle majeure"},
		{Priority: domain.PriorityMedium, MaxHours: 24, Description: "Demande standard"},
		{Priority: domain.PriorityLow, MaxHours: 72, Description: "Demande mineure"},
	}
	for i := range policies {
		_, err := repo.Get(context.Background(), policies[i].Priority)
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := repo.Upsert(context.Background(), &policies[i]); err != nil {
			return err
		}
	}
	return nil
}

func ensureInitialAdmin(userRepo domain.UserRepository, email, password string) error {
	ctx := context.Background()
	existing, err := userRepo.GetByEmail(ctx, email)
	if err == nil {
		if existing.Role != domain.RoleAdmin || !existing.IsActive {
			return fmt.Errorf("ADMIN_EMAIL is already assigned to a non-admin or inactive account")
		}
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash administrator password: %w", err)
	}
	return userRepo.Create(ctx, &domain.User{
		ID:           uuid.New(),
		FullName:     getEnv("ADMIN_NAME", "DeskFlow Administrator"),
		Email:        email,
		Matricule:    "ADM-001",
		PasswordHash: string(hash),
		Role:         domain.RoleAdmin,
		Department:   getEnv("ADMIN_DEPARTMENT", "Direction des Systèmes d'Information (DSI)"),
		IsActive:     true,
	})
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
