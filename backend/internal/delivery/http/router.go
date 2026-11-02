package http

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"deskflow/internal/delivery/http/middleware"
	"deskflow/internal/domain"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RouterDependencies struct {
	UserRepository domain.UserRepository
	AuthService    domain.AuthService
	TicketService  domain.TicketService
	AdminService   domain.AdminService
}

type authRequest struct {
	FullName   string `json:"full_name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Department string `json:"department"`
	Matricule  string `json:"matricule"`
}

type profileRequest struct {
	FullName        string `json:"full_name"`
	Email           string `json:"email"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type userPasswordRequest struct {
	Password string `json:"password"`
}

type ticketRequest struct {
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	Category         string  `json:"category"`
	EstimatedCost    float64 `json:"estimated_cost"`
	RequestLanguage  string  `json:"request_language"`
	RequestUTCOffset int     `json:"request_utc_offset_minutes"`
}

const (
	maxTicketImageCount = 5
	maxTicketImageSize  = 5 << 20
	maxTicketBodySize   = 27 << 20
)

type statusRequest struct {
	Status domain.TicketStatus `json:"status"`
	Notes  string              `json:"notes"`
}

type commentRequest struct {
	Content string `json:"content"`
}

type assignRequest struct {
	TechnicianID string `json:"technician_id"`
}

type roleRequest struct {
	Role domain.UserRole `json:"role"`
}

type departmentRequest struct {
	Department string `json:"department"`
}

type createUserRequest struct {
	FullName   string          `json:"full_name"`
	Email      string          `json:"email"`
	Password   string          `json:"password"`
	Department string          `json:"department"`
	Role       domain.UserRole `json:"role"`
	Matricule  string          `json:"matricule"`
}

type approvalRequest struct {
	Approved bool   `json:"approved"`
	Notes    string `json:"notes"`
}

type slaRequest struct {
	MaxHours    float64 `json:"max_hours"`
	Description string  `json:"description"`
}

type passwordResetRequest struct {
	Email string `json:"email"`
}

type passwordResetConfirmRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

type adminUserResponse struct {
	*domain.User
	LastIPAddress string     `json:"last_ip_address,omitempty"`
	LastSeenAt    *time.Time `json:"last_seen_at,omitempty"`
}

type createDepartmentRequest struct {
	Name string `json:"name"`
}

type renameDepartmentRequest struct {
	NewName string `json:"new_name"`
}

func SetupRouter(deps RouterDependencies) *gin.Engine {
	r := gin.New()
	var trustedProxies []string
	for _, proxy := range strings.Split(os.Getenv("TRUSTED_PROXIES"), ",") {
		if proxy = strings.TrimSpace(proxy); proxy != "" {
			trustedProxies = append(trustedProxies, proxy)
		}
	}
	if err := r.SetTrustedProxies(trustedProxies); err != nil {
		panic("TRUSTED_PROXIES configuration is invalid: " + err.Error())
	}
	r.Use(gin.Logger(), gin.Recovery(), corsMiddleware())
	r.Use(func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	api := r.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "deskflow"})
	})
	api.GET("/departments", func(c *gin.Context) {
		departments, err := deps.AdminService.ListDepartments(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"departments": departments})
	})
	api.POST("/auth/register", func(c *gin.Context) {
		var request authRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if !isDepartmentAvailable(c, deps.AdminService, request.Department) {
			return
		}
		user, token, err := deps.AuthService.Register(
			c.Request.Context(), request.FullName, request.Email, request.Password,
			request.Department, request.Matricule, domain.RoleUser,
		)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
	})
	api.POST("/auth/login", func(c *gin.Context) {
		var request struct {
			Identifier string `json:"identifier"`
			Password   string `json:"password"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		user, token, err := deps.AuthService.Login(c.Request.Context(), request.Identifier, request.Password)
		if err != nil {
			status := http.StatusUnauthorized
			if errors.Is(err, domain.ErrUserInactive) {
				status = http.StatusForbidden
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
	})
	api.POST("/auth/password-reset/request", func(c *gin.Context) {
		var request passwordResetRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if err := deps.AuthService.RequestPasswordReset(c.Request.Context(), request.Email); err != nil {
			if errors.Is(err, domain.ErrPasswordResetCooldown) {
				c.JSON(http.StatusAccepted, gin.H{"message": "Si cette adresse est associée à un compte, un code sera envoyé par e-mail."})
				return
			}
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusAccepted, gin.H{"message": "Si cette adresse est associée à un compte, un code sera envoyé par e-mail."})
	})
	api.POST("/auth/password-reset/confirm", func(c *gin.Context) {
		var request passwordResetConfirmRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if err := deps.AuthService.ResetPassword(c.Request.Context(), request.Email, request.Code, request.NewPassword); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "mot de passe réinitialisé"})
	})

	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(deps.UserRepository))
	protected.GET("/auth/me", func(c *gin.Context) {
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		user, err := deps.AdminService.GetUser(c.Request.Context(), userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": user})
	})
	protected.PUT("/auth/me/profile", func(c *gin.Context) {
		var request profileRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if request.CurrentPassword != "" || request.NewPassword != "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "seul un administrateur peut modifier le mot de passe"})
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		user, err := deps.AuthService.UpdateProfile(
			c.Request.Context(), userID, request.FullName, request.Email,
		)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": user})
	})
	protected.GET("/tickets", func(c *gin.Context) {
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		user, err := deps.AdminService.GetUser(c.Request.Context(), userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		tickets, err := deps.TicketService.ListTickets(c.Request.Context(), user, nil)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"tickets": tickets})
	})
	protected.GET("/tickets/sla/:category", func(c *gin.Context) {
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		policy, err := deps.TicketService.GetCategorySLA(c.Request.Context(), c.Param("category"), userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"policy": policy})
	})
	protected.POST("/tickets", func(c *gin.Context) {
		request, attachments, err := parseTicketCreateRequest(c)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "les fichiers joints dépassent la limite autorisée"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		ticket, err := deps.TicketService.CreateTicketWithAttachments(
			c.Request.Context(), request.Title, request.Description,
			request.Category, request.EstimatedCost, userID, c.ClientIP(), attachments,
			[]string{request.RequestLanguage}, request.RequestUTCOffset,
		)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ticket": ticket})
	})
	protected.GET("/tickets/:id", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		ticket, comments, history, err := deps.TicketService.GetTicket(c.Request.Context(), id)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		user, err := deps.AdminService.GetUser(c.Request.Context(), userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		if !canViewTicket(user, ticket) {
			c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ticket": ticket, "comments": comments, "history": history})
	})
	protected.GET("/tickets/:id/attachments/:attachmentID", func(c *gin.Context) {
		ticketID, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		attachmentID, ok := pathUUID(c, "attachmentID")
		if !ok {
			return
		}
		ticket, _, _, err := deps.TicketService.GetTicket(c.Request.Context(), ticketID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		user, err := deps.AdminService.GetUser(c.Request.Context(), userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		if !canViewTicket(user, ticket) {
			c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
			return
		}
		attachment, err := deps.TicketService.GetTicketAttachment(c.Request.Context(), ticketID, attachmentID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": attachment.FileName}))
		c.Data(http.StatusOK, attachment.ContentType, attachment.Data)
	})
	protected.POST("/tickets/:id/comments", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request commentRequest
		if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Content) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "commentaire invalide"})
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		comment, err := deps.TicketService.AddComment(c.Request.Context(), id, userID, request.Content)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"comment": comment})
	})
	protected.POST("/tickets/:id/take", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		if err := deps.TicketService.TakeTicket(c.Request.Context(), id, userID, c.ClientIP()); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ticket pris en charge"})
	})
	protected.PUT("/tickets/:id/status", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request statusRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		userID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		if err := deps.TicketService.ChangeStatus(c.Request.Context(), id, request.Status, userID, request.Notes, c.ClientIP()); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "statut mis à jour"})
	})

	supportOps := protected.Group("/admin")
	supportOps.Use(middleware.RequireRole(domain.RoleAdmin, domain.RoleChefDeSupport))
	supportOps.GET("/technicians", func(c *gin.Context) {
		users, err := deps.AdminService.ListAllUsers(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		technicians := make([]*domain.User, 0)
		for _, user := range users {
			if user.Role == domain.RoleTechnician && user.IsActive {
				technicians = append(technicians, user)
			}
		}
		c.JSON(http.StatusOK, gin.H{"users": technicians})
	})
	supportOps.POST("/tickets/:id/assign", func(c *gin.Context) {
		ticketID, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request assignRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		technicianID, err := uuid.Parse(request.TechnicianID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "identifiant technicien invalide"})
			return
		}
		authorID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		if err := deps.TicketService.AssignTicket(c.Request.Context(), ticketID, technicianID, authorID, c.ClientIP()); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ticket assigné"})
	})

	admin := protected.Group("/admin")
	admin.Use(middleware.RequireRole(domain.RoleAdmin))
	admin.GET("/metrics", func(c *gin.Context) {
		metrics, err := deps.AdminService.GetDashboardMetrics(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"metrics": metrics})
	})
	admin.GET("/users", func(c *gin.Context) {
		users, err := deps.AdminService.ListAllUsers(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		response := make([]adminUserResponse, 0, len(users))
		for _, user := range users {
			response = append(response, adminUserResponse{
				User:          user,
				LastIPAddress: user.LastIPAddress,
				LastSeenAt:    user.LastSeenAt,
			})
		}
		c.JSON(http.StatusOK, gin.H{"users": response})
	})
	admin.POST("/departments", func(c *gin.Context) {
		var request createDepartmentRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if err := deps.AdminService.CreateDepartment(c.Request.Context(), request.Name); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "département créé"})
	})
	admin.PUT("/departments/:name", func(c *gin.Context) {
		var request renameDepartmentRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if err := deps.AdminService.RenameDepartment(c.Request.Context(), c.Param("name"), request.NewName); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "département modifié"})
	})
	admin.DELETE("/departments/:name", func(c *gin.Context) {
		if err := deps.AdminService.DeleteDepartment(c.Request.Context(), c.Param("name")); err != nil {
			writeServiceError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
	admin.GET("/sla", func(c *gin.Context) {
		policies, err := deps.AdminService.ListSLAPolicies(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"policies": policies})
	})
	admin.GET("/audit", func(c *gin.Context) {
		entries, err := deps.AdminService.ListAuditLogs(c.Request.Context())
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"logs": entries})
	})
	admin.PUT("/sla/:priority", func(c *gin.Context) {
		var request slaRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		policy := &domain.SLAPolicy{
			Priority:    domain.TicketPriority(strings.ToUpper(c.Param("priority"))),
			MaxHours:    request.MaxHours,
			Description: strings.TrimSpace(request.Description),
		}
		if err := deps.AdminService.UpdateSLAPolicy(c.Request.Context(), policy); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"policy": policy})
	})
	admin.POST("/users", func(c *gin.Context) {
		var request createUserRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if !isDepartmentAvailable(c, deps.AdminService, request.Department) {
			return
		}
		switch request.Role {
		case domain.RoleAdmin, domain.RoleChefDeSupport, domain.RoleTechnician, domain.RoleChefDeService, domain.RoleUser:
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "rôle invalide"})
			return
		}
		user, _, err := deps.AuthService.Register(
			c.Request.Context(), request.FullName, request.Email, request.Password,
			request.Department, request.Matricule, request.Role,
		)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"user": user})
	})
	admin.PUT("/users/:id/password", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request userPasswordRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		if err := deps.AdminService.SetUserPassword(c.Request.Context(), id, request.Password); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "mot de passe mis à jour"})
	})
	admin.PUT("/users/:id/role", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request roleRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rôle invalide"})
			return
		}
		if err := deps.AdminService.ChangeUserRole(c.Request.Context(), id, request.Role); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "rôle mis à jour"})
	})
	admin.PUT("/users/:id/department", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request departmentRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "département invalide"})
			return
		}
		if !isDepartmentAvailable(c, deps.AdminService, request.Department) {
			return
		}
		if err := deps.AdminService.UpdateUserDepartment(c.Request.Context(), id, request.Department); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "département mis à jour"})
	})
	admin.POST("/tickets/:id/approval", func(c *gin.Context) {
		ticketID, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		var request approvalRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
			return
		}
		authorID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		nextStatus := domain.StatusRejected
		if request.Approved {
			nextStatus = domain.StatusPending
		}
		if err := deps.TicketService.ChangeStatus(c.Request.Context(), ticketID, nextStatus, authorID, request.Notes, c.ClientIP()); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "décision enregistrée"})
	})
	admin.DELETE("/tickets/:id", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		authorID, ok := currentUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}
		if err := deps.TicketService.DeleteTicket(c.Request.Context(), id, authorID); err != nil {
			writeServiceError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
	admin.PATCH("/users/:id/active", func(c *gin.Context) {
		id, ok := pathUUID(c, "id")
		if !ok {
			return
		}
		authorID, ok := currentUserID(c)
		if !ok || authorID == id {
			c.JSON(http.StatusBadRequest, gin.H{"error": "impossible de désactiver son propre compte"})
			return
		}
		if err := deps.AdminService.ToggleUserActive(c.Request.Context(), id); err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "état utilisateur mis à jour"})
	})
	return r
}

func currentUserID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}
	id, ok := value.(uuid.UUID)
	return id, ok
}

func pathUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(key))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "identifiant invalide"})
		return uuid.Nil, false
	}
	return id, true
}

func canViewTicket(user *domain.User, ticket *domain.Ticket) bool {
	if user == nil {
		return false
	}
	switch user.Role {
	case domain.RoleAdmin, domain.RoleChefDeSupport:
		return true
	case domain.RoleTechnician:
		return ticket.Status == domain.StatusPending ||
			(ticket.AssignedToID != nil && *ticket.AssignedToID == user.ID)
	case domain.RoleChefDeService:
		return ticket.CreatedByID == user.ID || strings.EqualFold(ticket.Department, user.Department)
	default:
		return ticket.CreatedByID == user.ID
	}
}

func isDepartmentAvailable(c *gin.Context, adminService domain.AdminService, name string) bool {
	departments, err := adminService.ListDepartments(c.Request.Context())
	if err != nil {
		writeServiceError(c, err)
		return false
	}
	for _, department := range departments {
		if department.Name == strings.TrimSpace(name) {
			return true
		}
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": "sélectionnez un département existant"})
	return false
}

func parseTicketCreateRequest(c *gin.Context) (ticketRequest, []domain.TicketAttachment, error) {
	var request ticketRequest
	if !strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		if err := c.ShouldBindJSON(&request); err != nil {
			return request, nil, errors.New("requête invalide")
		}
		return request, nil, nil
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTicketBodySize)
	form, err := c.MultipartForm()
	if err != nil {
		return request, nil, err
	}
	if form != nil {
		defer form.RemoveAll()
	}
	request.Title = c.PostForm("title")
	request.Description = c.PostForm("description")
	request.Category = c.PostForm("category")
	request.RequestLanguage = c.PostForm("request_language")
	if offset := c.PostForm("request_utc_offset_minutes"); offset != "" {
		request.RequestUTCOffset, err = strconv.Atoi(offset)
		if err != nil || request.RequestUTCOffset < -840 || request.RequestUTCOffset > 840 {
			return request, nil, errors.New("fuseau horaire invalide")
		}
	}
	if cost := c.PostForm("estimated_cost"); cost != "" {
		request.EstimatedCost, err = strconv.ParseFloat(cost, 64)
		if err != nil {
			return request, nil, errors.New("coût estimé invalide")
		}
	}
	files := form.File["images"]
	if len(files) > maxTicketImageCount {
		return request, nil, errors.New("cinq images maximum par demande")
	}

	attachments := make([]domain.TicketAttachment, 0, len(files))
	for _, fileHeader := range files {
		if fileHeader.Size <= 0 || fileHeader.Size > maxTicketImageSize {
			return request, nil, errors.New("chaque image doit peser au maximum 5 Mo")
		}
		file, openErr := fileHeader.Open()
		if openErr != nil {
			return request, nil, errors.New("impossible de lire une image jointe")
		}
		data, readErr := io.ReadAll(io.LimitReader(file, maxTicketImageSize+1))
		closeErr := file.Close()
		if readErr != nil {
			return request, nil, errors.New("impossible de lire une image jointe")
		}
		if closeErr != nil {
			return request, nil, errors.New("impossible de fermer une image jointe")
		}
		if len(data) == 0 || len(data) > maxTicketImageSize {
			return request, nil, errors.New("chaque image doit peser au maximum 5 Mo")
		}
		contentType := http.DetectContentType(data)
		switch contentType {
		case "image/jpeg", "image/png", "image/gif", "image/webp":
		default:
			return request, nil, errors.New("format accepté : JPEG, PNG, GIF ou WebP")
		}
		fileName := filepath.Base(strings.ReplaceAll(fileHeader.Filename, "\\", "/"))
		if fileName == "." || fileName == "" || strings.ContainsRune(fileName, '\x00') {
			return request, nil, errors.New("nom de fichier invalide")
		}
		attachments = append(attachments, domain.TicketAttachment{
			FileName:    fileName,
			ContentType: contentType,
			Size:        int64(len(data)),
			Data:        data,
		})
	}
	return request, attachments, nil
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := make(map[string]struct{})
	for _, origin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowedOrigins[origin] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Vary", "Origin")
			if _, allowed := allowedOrigins[origin]; !allowed {
				if c.Request.Method == http.MethodOptions {
					c.AbortWithStatus(http.StatusForbidden)
					return
				}
				c.Next()
				return
			}

			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}
		c.Next()
	}
}

func writeServiceError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	if errors.Is(err, gorm.ErrRecordNotFound) || errors.Is(err, domain.ErrTicketNotFound) || errors.Is(err, domain.ErrUserNotFound) {
		status = http.StatusNotFound
	} else if errors.Is(err, domain.ErrUnauthorized) {
		status = http.StatusForbidden
	} else if errors.Is(err, domain.ErrInvalidInput) {
		status = http.StatusBadRequest
	} else if errors.Is(err, domain.ErrIdentityConflict) {
		status = http.StatusConflict
	} else if errors.Is(err, domain.ErrInvalidCredentials) {
		status = http.StatusUnauthorized
	} else if errors.Is(err, domain.ErrInvalidStatusChange) {
		status = http.StatusConflict
	} else if errors.Is(err, domain.ErrTechnicianBusy) || errors.Is(err, domain.ErrPasswordResetCooldown) {
		status = http.StatusConflict
	} else if errors.Is(err, domain.ErrTicketNotNextInQueue) {
		status = http.StatusConflict
	} else if errors.Is(err, domain.ErrDepartmentInUse) || errors.Is(err, domain.ErrDepartmentExists) {
		status = http.StatusConflict
	} else if errors.Is(err, domain.ErrPasswordResetInvalid) {
		status = http.StatusBadRequest
	}

	c.JSON(status, gin.H{"error": err.Error()})
}
