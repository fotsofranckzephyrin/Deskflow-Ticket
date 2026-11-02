package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://deskflow.example, https://preview.deskflow.example")

	router := gin.New()
	router.Use(corsMiddleware())
	router.OPTIONS("/api/v1/tickets", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	tests := []struct {
		name              string
		origin            string
		wantStatus        int
		wantAllowedOrigin string
	}{
		{
			name:              "configured origin is allowed",
			origin:            "https://deskflow.example",
			wantStatus:        http.StatusNoContent,
			wantAllowedOrigin: "https://deskflow.example",
		},
		{
			name:       "unconfigured origin is rejected",
			origin:     "https://untrusted.example",
			wantStatus: http.StatusForbidden,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodOptions, "/api/v1/tickets", nil)
			request.Header.Set("Origin", test.origin)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != test.wantAllowedOrigin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, test.wantAllowedOrigin)
			}
		})
	}
}
