package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
)

type TicketService struct {
	ticketRepo domain.TicketRepository
	userRepo   domain.UserRepository
	slaRepo    domain.SLARepository
	email      domain.EmailSender
}

func NewTicketService(ticketRepo domain.TicketRepository, userRepo domain.UserRepository, slaRepo domain.SLARepository, emailSenders ...domain.EmailSender) *TicketService {
	var emailSender domain.EmailSender
	if len(emailSenders) > 0 {
		emailSender = emailSenders[0]
	}
	return &TicketService{
		ticketRepo: ticketRepo,
		userRepo:   userRepo,
		slaRepo:    slaRepo,
		email:      emailSender,
	}
}

func (s *TicketService) CreateTicket(ctx context.Context, title, description, category string, estimatedCost float64, authorID uuid.UUID, ipAddress string) (*domain.Ticket, error) {
	return s.CreateTicketWithAttachments(ctx, title, description, category, estimatedCost, authorID, ipAddress, nil, nil)
}

func (s *TicketService) CreateTicketWithAttachments(
	ctx context.Context,
	title, description, category string,
	estimatedCost float64,
	authorID uuid.UUID,
	ipAddress string,
	attachments []domain.TicketAttachment,
	requestLanguages []string,
	requestUTCOffsets ...int,
) (*domain.Ticket, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	category = strings.ToUpper(strings.TrimSpace(category))
	if title == "" || description == "" || category == "" {
		return nil, errors.New("données du ticket incomplètes")
	}
	if estimatedCost < 0 || math.Trunc(estimatedCost) != estimatedCost {
		return nil, fmt.Errorf("%w: le coût estimé doit être un nombre entier positif", domain.ErrInvalidInput)
	}
	if len(attachments) > 5 {
		return nil, fmt.Errorf("%w: cinq images maximum par demande", domain.ErrInvalidInput)
	}
	for i := range attachments {
		attachment := &attachments[i]
		if attachment.FileName == "" || len(attachment.FileName) > 255 ||
			attachment.Size <= 0 || attachment.Size > 5<<20 ||
			int64(len(attachment.Data)) != attachment.Size {
			return nil, fmt.Errorf("%w: image invalide ou supérieure à 5 Mo", domain.ErrInvalidInput)
		}
		switch attachment.ContentType {
		case "image/jpeg", "image/png", "image/gif", "image/webp":
		default:
			return nil, fmt.Errorf("%w: format d'image non pris en charge", domain.ErrInvalidInput)
		}
		attachment.ID = uuid.New()
	}
	author, err := s.userRepo.GetByID(ctx, authorID)
	if err != nil {
		return nil, domain.ErrUserNotFound
	}
	policy, err := s.GetCategorySLA(ctx, category, authorID)
	if err != nil {
		return nil, err
	}
	priority := policy.Priority
	status := domain.StatusPending
	requiresApproval := strings.EqualFold(category, "HARDWARE") && estimatedCost > 500000
	if requiresApproval {
		status = domain.StatusPendingApproval
	}
	now := time.Now()
	requestLanguage := "fr"
	if len(requestLanguages) > 0 && strings.EqualFold(strings.TrimSpace(requestLanguages[0]), "en") {
		requestLanguage = "en"
	}
	requestUTCOffset := 0
	if len(requestUTCOffsets) > 0 {
		if requestUTCOffsets[0] < -840 || requestUTCOffsets[0] > 840 {
			return nil, fmt.Errorf("%w: fuseau horaire invalide", domain.ErrInvalidInput)
		}
		requestUTCOffset = requestUTCOffsets[0]
	}
	ticketID := uuid.New()
	ticket := &domain.Ticket{
		ID:               ticketID,
		Title:            title,
		Description:      description,
		Category:         category,
		RequestLanguage:  requestLanguage,
		RequestUTCOffset: requestUTCOffset,
		Priority:         priority,
		Status:           status,
		CreatedByID:      authorID,
		Department:       author.Department,
		EstimatedCost:    estimatedCost,
		RequiresApproval: requiresApproval,
		SLADeadline:      now.Add(time.Duration(policy.MaxHours * float64(time.Hour))),
		AuditIPAddress:   ipAddress,
	}
	for i := range attachments {
		attachments[i].TicketID = ticketID
	}
	ticket.Attachments = attachments

	if err := s.ticketRepo.Create(ctx, ticket); err != nil {
		return nil, err
	}

	if status == domain.StatusPending {
		if err := s.assignQueuedTickets(ctx, authorID, ipAddress); err != nil {
			return nil, err
		}
	}
	return s.ticketRepo.GetByID(ctx, ticket.ID)
}

func (s *TicketService) GetTicketAttachment(ctx context.Context, ticketID, attachmentID uuid.UUID) (*domain.TicketAttachment, error) {
	return s.ticketRepo.GetAttachment(ctx, ticketID, attachmentID)
}

func (s *TicketService) GetCategorySLA(ctx context.Context, category string, authorID uuid.UUID) (*domain.SLAPolicy, error) {
	author, err := s.userRepo.GetByID(ctx, authorID)
	if err != nil {
		return nil, domain.ErrUserNotFound
	}
	switch strings.ToUpper(strings.TrimSpace(category)) {
	case "HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "GENERAL":
	default:
		return nil, fmt.Errorf("%w: catégorie invalide", domain.ErrInvalidInput)
	}
	priority := categoryPriority(category)
	if author.Role == domain.RoleChefDeService {
		priority = domain.PriorityUrgent
	}
	policy, err := s.slaRepo.Get(ctx, priority)
	if err != nil {
		return nil, fmt.Errorf("load SLA policy: %w", err)
	}
	return policy, nil
}

func categoryPriority(category string) domain.TicketPriority {
	switch strings.ToUpper(strings.TrimSpace(category)) {
	case "NETWORK":
		return domain.PriorityUrgent
	case "HARDWARE", "ACCESS":
		return domain.PriorityHigh
	case "SOFTWARE":
		return domain.PriorityMedium
	default:
		return domain.PriorityLow
	}
}

func (s *TicketService) GetTicket(ctx context.Context, id uuid.UUID) (*domain.Ticket, []*domain.TicketComment, []*domain.TicketHistory, error) {
	ticket, err := s.ticketRepo.GetByID(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	comments, err := s.ticketRepo.GetComments(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	history, err := s.ticketRepo.GetHistory(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	return ticket, comments, history, nil
}

func (s *TicketService) ListTickets(ctx context.Context, user *domain.User, status *domain.TicketStatus) ([]*domain.Ticket, error) {
	if user == nil {
		return nil, domain.ErrUnauthorized
	}
	switch user.Role {
	case domain.RoleAdmin, domain.RoleChefDeSupport:
		tickets, err := s.ticketRepo.List(ctx, status, nil, nil)
		sort.Slice(tickets, func(i, j int) bool { return tickets[i].SLADeadline.Before(tickets[j].SLADeadline) })
		return tickets, err
	case domain.RoleTechnician:
		tickets, err := s.ticketRepo.List(ctx, status, nil, nil)
		if err != nil {
			return nil, err
		}
		filtered := make([]*domain.Ticket, 0)
		for _, ticket := range tickets {
			if (ticket.AssignedToID != nil && *ticket.AssignedToID == user.ID) ||
				(ticket.Status == domain.StatusPending && ticket.AssignedToID == nil) {
				filtered = append(filtered, ticket)
			}
		}
		sort.Slice(filtered, func(i, j int) bool { return filtered[i].SLADeadline.Before(filtered[j].SLADeadline) })
		return filtered, nil
	case domain.RoleChefDeService, domain.RoleUser:
		tickets, err := s.ticketRepo.List(ctx, status, nil, nil)
		if err != nil {
			return nil, err
		}
		filtered := make([]*domain.Ticket, 0)
		for _, ticket := range tickets {
			if ticket.CreatedByID == user.ID ||
				(user.Role == domain.RoleChefDeService && strings.EqualFold(ticket.Department, user.Department)) {
				filtered = append(filtered, ticket)
			}
		}
		return filtered, nil
	default:
		return nil, domain.ErrUnauthorized
	}
}

func (s *TicketService) ChangeStatus(ctx context.Context, ticketID uuid.UUID, newStatus domain.TicketStatus, authorID uuid.UUID, notes, ipAddress string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}
	author, err := s.userRepo.GetByID(ctx, authorID)
	if err != nil {
		return domain.ErrUserNotFound
	}

	if err := validateTicketStatusChange(ticket, author, newStatus, authorID); err != nil {
		return err
	}

	if newStatus == domain.StatusPending &&
		(ticket.Status == domain.StatusResolved || ticket.Status == domain.StatusClosed) {
		if err := s.ticketRepo.Reopen(ctx, ticketID, authorID, notes, ipAddress); err != nil {
			return err
		}
	} else if err := s.ticketRepo.UpdateStatusWithAudit(ctx, ticketID, newStatus, authorID, notes, ipAddress); err != nil {
		return err
	}
	var dispatchErr error
	if newStatus == domain.StatusPending || newStatus == domain.StatusResolved || newStatus == domain.StatusRejected {
		dispatchErr = s.assignQueuedTickets(ctx, authorID, ipAddress)
	}
	var notificationErr error
	if newStatus == domain.StatusResolved || newStatus == domain.StatusRejected {
		notificationErr = s.notifyRequester(ctx, ticket, newStatus, notes, authorID)
	}
	if dispatchErr != nil && notificationErr != nil {
		return fmt.Errorf("statut enregistré; dispatch automatique impossible: %v; notification impossible: %w", dispatchErr, notificationErr)
	}
	if dispatchErr != nil {
		return fmt.Errorf("statut enregistré; dispatch automatique impossible: %w", dispatchErr)
	}
	return notificationErr
}

func validateTicketStatusChange(ticket *domain.Ticket, author *domain.User, newStatus domain.TicketStatus, authorID uuid.UUID) error {
	if ticket == nil || author == nil {
		return domain.ErrUnauthorized
	}

	switch author.Role {
	case domain.RoleAdmin, domain.RoleChefDeSupport:
	case domain.RoleTechnician:
		if ticket.AssignedToID == nil || *ticket.AssignedToID != authorID {
			return domain.ErrUnauthorized
		}
	case domain.RoleUser, domain.RoleChefDeService:
		canClose := ticket.Status == domain.StatusResolved && newStatus == domain.StatusClosed
		canReopen := (ticket.Status == domain.StatusResolved || ticket.Status == domain.StatusClosed) &&
			newStatus == domain.StatusPending
		if ticket.CreatedByID != authorID || (!canClose && !canReopen) {
			return domain.ErrUnauthorized
		}
	default:
		return domain.ErrUnauthorized
	}

	validTransition := false
	switch ticket.Status {
	case domain.StatusPendingApproval:
		validTransition = (author.Role == domain.RoleAdmin) &&
			(newStatus == domain.StatusPending || newStatus == domain.StatusRejected)
	case domain.StatusPending:
		validTransition = newStatus == domain.StatusAssigned || newStatus == domain.StatusClosed ||
			(newStatus == domain.StatusRejected && (author.Role == domain.RoleAdmin || author.Role == domain.RoleChefDeSupport))
	case domain.StatusAssigned:
		validTransition = newStatus == domain.StatusInProgress ||
			(newStatus == domain.StatusPending && author.Role != domain.RoleTechnician) ||
			(newStatus == domain.StatusRejected && (author.Role == domain.RoleAdmin || author.Role == domain.RoleChefDeSupport))
	case domain.StatusInProgress:
		validTransition = newStatus == domain.StatusResolved ||
			(newStatus == domain.StatusPending && author.Role != domain.RoleTechnician) ||
			(newStatus == domain.StatusRejected && (author.Role == domain.RoleAdmin || author.Role == domain.RoleChefDeSupport))
	case domain.StatusResolved:
		validTransition = newStatus == domain.StatusClosed ||
			newStatus == domain.StatusInProgress ||
			(newStatus == domain.StatusPending &&
				(ticket.CreatedByID == authorID || author.Role == domain.RoleAdmin || author.Role == domain.RoleChefDeSupport))
	case domain.StatusClosed:
		validTransition = newStatus == domain.StatusPending &&
			(ticket.CreatedByID == authorID || author.Role == domain.RoleAdmin || author.Role == domain.RoleChefDeSupport)
	}
	if !validTransition {
		return domain.ErrInvalidStatusChange
	}
	return nil
}

func (s *TicketService) AssignTicket(ctx context.Context, ticketID, techID, adminID uuid.UUID, ipAddress string) error {
	author, err := s.userRepo.GetByID(ctx, adminID)
	if err != nil {
		return domain.ErrUserNotFound
	}
	if author.Role != domain.RoleAdmin && author.Role != domain.RoleChefDeSupport {
		return domain.ErrUnauthorized
	}
	technician, err := s.userRepo.GetByID(ctx, techID)
	if err != nil {
		return domain.ErrUserNotFound
	}
	if !technician.IsActive || technician.Role != domain.RoleTechnician {
		return errors.New("le compte choisi n'est pas un technicien actif")
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}
	if ticket.Status != domain.StatusPending && ticket.Status != domain.StatusAssigned && ticket.Status != domain.StatusInProgress {
		return domain.ErrInvalidStatusChange
	}
	return s.ticketRepo.Assign(ctx, ticketID, techID, adminID, ipAddress)
}

func (s *TicketService) TakeTicket(ctx context.Context, ticketID, technicianID uuid.UUID, ipAddress string) error {
	technician, err := s.userRepo.GetByID(ctx, technicianID)
	if err != nil {
		return domain.ErrUserNotFound
	}
	if technician.Role != domain.RoleTechnician || !technician.IsActive {
		return domain.ErrUnauthorized
	}
	tickets, err := s.ticketRepo.List(ctx, nil, nil, nil)
	if err != nil {
		return err
	}
	for _, ticket := range tickets {
		if ticket.AssignedToID != nil && *ticket.AssignedToID == technicianID &&
			(ticket.Status == domain.StatusAssigned || ticket.Status == domain.StatusInProgress) {
			return domain.ErrTechnicianBusy
		}
	}
	requested, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}
	if requested.Status != domain.StatusPending || requested.AssignedToID != nil {
		return domain.ErrInvalidStatusChange
	}
	queue := make([]*domain.Ticket, 0)
	for _, ticket := range tickets {
		if ticket.Status == domain.StatusPending && ticket.AssignedToID == nil {
			queue = append(queue, ticket)
		}
	}
	sortQueuedTickets(queue)
	if len(queue) == 0 || queue[0].ID != ticketID {
		return domain.ErrTicketNotNextInQueue
	}
	return s.ticketRepo.Take(ctx, ticketID, technicianID, ipAddress)
}

func (s *TicketService) notifyRequester(ctx context.Context, ticket *domain.Ticket, status domain.TicketStatus, notes string, authorID uuid.UUID) error {
	requester, err := s.userRepo.GetByID(ctx, ticket.CreatedByID)
	if err != nil {
		return fmt.Errorf("load ticket requester for notification: %w", err)
	}
	statusLabel := "résolue"
	if status == domain.StatusRejected {
		statusLabel = "rejetée"
	}
	greeting := "Bonjour"
	if ticket.RequestLanguage == "en" {
		greeting = "Hello"
	}
	switch hour := time.Now().UTC().Add(-time.Duration(ticket.RequestUTCOffset) * time.Minute).Hour(); {
	case ticket.RequestLanguage == "en" && hour < 12:
		greeting = "Good morning"
	case ticket.RequestLanguage == "en" && hour >= 18:
		greeting = "Good evening"
	case ticket.RequestLanguage != "en" && hour < 12:
		greeting = "Bonjour"
	case ticket.RequestLanguage != "en" && hour >= 18:
		greeting = "Bonsoir"
	}
	message := fmt.Sprintf("%s %s,\n\n%s\nRéférence : %s\nObjet : %s\nDescription : %s",
		greeting, requester.FullName,
		"Votre demande a été "+statusLabel+".",
		ticket.TicketNumber, ticket.Title, ticket.Description)
	if ticket.RequestLanguage == "en" {
		message = fmt.Sprintf("%s %s,\n\nYour request has been %s.\nReference: %s\nSubject: %s\nDescription: %s",
			greeting, requester.FullName, map[domain.TicketStatus]string{
				domain.StatusResolved: "resolved", domain.StatusRejected: "rejected",
			}[status], ticket.TicketNumber, ticket.Title, ticket.Description)
	}
	if strings.TrimSpace(notes) != "" {
		noteLabel := "Commentaire : "
		if ticket.RequestLanguage == "en" {
			noteLabel = "Comment: "
		}
		message += "\n" + noteLabel + strings.TrimSpace(notes)
	}
	messageErr := s.ticketRepo.AddComment(ctx, &domain.TicketComment{
		ID:        uuid.New(),
		TicketID:  ticket.ID,
		UserID:    authorID,
		Content:   message,
		CreatedAt: time.Now(),
	})
	var emailErr error
	if s.email == nil {
		emailErr = errors.New("service d'envoi d'e-mail non configuré")
	} else {
		body := message + "\n"
		subject := "Mise à jour de votre demande DeskFlow"
		if ticket.RequestLanguage == "en" {
			subject = "DeskFlow request update"
		}
		emailErr = s.email.Send(requester.Email, subject, body)
	}
	if messageErr != nil && emailErr != nil {
		return fmt.Errorf("statut modifié; message dans l'application impossible: %v; notification e-mail impossible: %w", messageErr, emailErr)
	}
	if messageErr != nil {
		return fmt.Errorf("statut modifié; message dans l'application impossible: %w", messageErr)
	}
	if emailErr != nil {
		return fmt.Errorf("statut modifié et message ajouté dans l'application; notification e-mail impossible: %w", emailErr)
	}
	return nil
}

func sortQueuedTickets(tickets []*domain.Ticket) {
	sort.SliceStable(tickets, func(i, j int) bool {
		if tickets[i].Priority != tickets[j].Priority {
			return priorityRank(tickets[i].Priority) > priorityRank(tickets[j].Priority)
		}
		if !tickets[i].CreatedAt.Equal(tickets[j].CreatedAt) {
			return tickets[i].CreatedAt.Before(tickets[j].CreatedAt)
		}
		return tickets[i].TicketNumber < tickets[j].TicketNumber
	})
}

func priorityRank(priority domain.TicketPriority) int {
	switch priority {
	case domain.PriorityUrgent:
		return 4
	case domain.PriorityHigh:
		return 3
	case domain.PriorityMedium:
		return 2
	default:
		return 1
	}
}

func (s *TicketService) assignAutomatically(ctx context.Context, ticket *domain.Ticket, authorID uuid.UUID, ipAddress string) error {
	users, err := s.userRepo.List(ctx)
	if err != nil {
		return err
	}
	tickets, err := s.ticketRepo.List(ctx, nil, nil, nil)
	if err != nil {
		return err
	}
	busy := make(map[uuid.UUID]bool)
	for _, current := range tickets {
		if current.AssignedToID != nil &&
			(current.Status == domain.StatusAssigned || current.Status == domain.StatusInProgress) {
			busy[*current.AssignedToID] = true
		}
	}
	candidates := make([]*domain.User, 0)
	for _, user := range users {
		if user.Role == domain.RoleTechnician && user.IsActive && !busy[user.ID] {
			candidates = append(candidates, user)
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		leftMatch := strings.EqualFold(candidates[i].Department, ticket.Department)
		rightMatch := strings.EqualFold(candidates[j].Department, ticket.Department)
		if leftMatch != rightMatch {
			return leftMatch
		}
		return candidates[i].CreatedAt.Before(candidates[j].CreatedAt)
	})
	for _, candidate := range candidates {
		err := s.ticketRepo.Assign(ctx, ticket.ID, candidate.ID, authorID, ipAddress)
		if errors.Is(err, domain.ErrTechnicianBusy) {
			continue
		}
		return err
	}
	return nil
}

func (s *TicketService) assignQueuedTickets(ctx context.Context, authorID uuid.UUID, ipAddress string) error {
	tickets, err := s.ticketRepo.List(ctx, nil, nil, nil)
	if err != nil {
		return err
	}
	queued := make([]*domain.Ticket, 0)
	for _, ticket := range tickets {
		if ticket.Status == domain.StatusPending && ticket.AssignedToID == nil {
			queued = append(queued, ticket)
		}
	}
	sortQueuedTickets(queued)
	for _, ticket := range queued {
		if err := s.assignAutomatically(ctx, ticket, authorID, ipAddress); err != nil {
			return err
		}
	}
	return nil
}

func (s *TicketService) DeleteTicket(ctx context.Context, ticketID, authorID uuid.UUID) error {
	author, err := s.userRepo.GetByID(ctx, authorID)
	if err != nil {
		return domain.ErrUserNotFound
	}
	if author.Role != domain.RoleAdmin {
		return domain.ErrUnauthorized
	}
	return s.ticketRepo.Delete(ctx, ticketID)
}

func (s *TicketService) AddComment(ctx context.Context, ticketID, authorID uuid.UUID, content string) (*domain.TicketComment, error) {
	if strings.TrimSpace(content) == "" {
		return nil, errors.New("contenu du commentaire vide")
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	author, err := s.userRepo.GetByID(ctx, authorID)
	if err != nil {
		return nil, domain.ErrUserNotFound
	}
	if author.Role != domain.RoleAdmin && author.Role != domain.RoleChefDeSupport &&
		ticket.CreatedByID != authorID && (ticket.AssignedToID == nil || *ticket.AssignedToID != authorID) {
		return nil, domain.ErrUnauthorized
	}

	comment := &domain.TicketComment{
		ID:        uuid.New(),
		TicketID:  ticketID,
		UserID:    authorID,
		Content:   content,
		CreatedAt: time.Now(),
	}

	if err := s.ticketRepo.AddComment(ctx, comment); err != nil {
		return nil, err
	}

	return comment, nil
}
