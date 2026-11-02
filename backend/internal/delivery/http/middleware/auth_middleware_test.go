package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"deskflow/internal/domain"

	"github.com/gin-gonic/gin"
)

func TestRequireRoleAdminOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		role       domain.UserRole
		wantStatus int
	}{
		{name: "admin allowed", role: domain.RoleAdmin, wantStatus: http.StatusNoContent},
		{name: "regular user denied", role: domain.RoleUser, wantStatus: http.StatusForbidden},
		{name: "support lead denied", role: domain.RoleChefDeSupport, wantStatus: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set("userRole", test.role)
				c.Next()
			}, RequireRole(domain.RoleAdmin))
			router.PUT("/admin/users/:id/password", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodPut, "/admin/users/user-id/password", nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
		})
	}
}
