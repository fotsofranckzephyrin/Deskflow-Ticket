package service

import (
	"errors"
	"testing"
	"time"

	"deskflow/internal/domain"

	"github.com/google/uuid"
)

func TestCategoryPriority(t *testing.T) {
	tests := []struct {
		category string
		want     domain.TicketPriority
	}{
		{category: "NETWORK", want: domain.PriorityUrgent},
		{category: "HARDWARE", want: domain.PriorityHigh},
		{category: "ACCESS", want: domain.PriorityHigh},
		{category: "SOFTWARE", want: domain.PriorityMedium},
		{category: "GENERAL", want: domain.PriorityLow},
		{category: " network ", want: domain.PriorityUrgent},
	}
	for _, test := range tests {
		t.Run(test.category, func(t *testing.T) {
			if got := categoryPriority(test.category); got != test.want {
				t.Fatalf("categoryPriority(%q) = %q, want %q", test.category, got, test.want)
			}
		})
	}
}

func TestRequesterCanReopenResolvedOrClosedTicket(t *testing.T) {
	requesterID := uuid.New()
	requester := &domain.User{ID: requesterID, Role: domain.RoleUser}
	for _, status := range []domain.TicketStatus{domain.StatusResolved, domain.StatusClosed} {
		t.Run(string(status), func(t *testing.T) {
			ticket := &domain.Ticket{CreatedByID: requesterID, Status: status}
			if err := validateTicketStatusChange(ticket, requester, domain.StatusPending, requesterID); err != nil {
				t.Fatalf("expected requester to reopen ticket: %v", err)
			}
		})
	}
}

func TestOnlyRequesterCanReopenTheirResolvedTicket(t *testing.T) {
	requesterID := uuid.New()
	otherUserID := uuid.New()
	ticket := &domain.Ticket{CreatedByID: requesterID, Status: domain.StatusResolved}
	otherUser := &domain.User{ID: otherUserID, Role: domain.RoleUser}

	err := validateTicketStatusChange(ticket, otherUser, domain.StatusPending, otherUserID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
}

func TestSupportCanRejectActiveTicket(t *testing.T) {
	adminID := uuid.New()
	admin := &domain.User{ID: adminID, Role: domain.RoleAdmin}
	for _, status := range []domain.TicketStatus{
		domain.StatusPending,
		domain.StatusAssigned,
		domain.StatusInProgress,
	} {
		t.Run(string(status), func(t *testing.T) {
			ticket := &domain.Ticket{Status: status}
			if err := validateTicketStatusChange(ticket, admin, domain.StatusRejected, adminID); err != nil {
				t.Fatalf("expected administrator to reject ticket: %v", err)
			}
		})
	}
}

func TestQueuedTicketsPrioritizeUrgencyThenAge(t *testing.T) {
	oldestNormal := &domain.Ticket{
		TicketNumber: "TCK-00001",
		Priority:     domain.PriorityLow,
		CreatedAt:    time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC),
	}
	oldUrgent := &domain.Ticket{
		TicketNumber: "TCK-00002",
		Priority:     domain.PriorityUrgent,
		CreatedAt:    time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC),
	}
	newUrgent := &domain.Ticket{
		TicketNumber: "TCK-00003",
		Priority:     domain.PriorityUrgent,
		CreatedAt:    time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC),
	}
	queue := []*domain.Ticket{newUrgent, oldestNormal, oldUrgent}

	sortQueuedTickets(queue)

	if queue[0] != oldUrgent || queue[1] != newUrgent || queue[2] != oldestNormal {
		t.Fatalf("queue order did not prioritize urgent and oldest tickets: %#v", queue)
	}
}
