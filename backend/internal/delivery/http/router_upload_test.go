package http

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func multipartTicketContext(t *testing.T, imageCount int, fileName string, data []byte) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range map[string]string{
		"title":          "Écran cassé",
		"description":    "Photo jointe",
		"category":       "HARDWARE",
		"estimated_cost": "0",
	} {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < imageCount; i++ {
		part, err := writer.CreateFormFile("images", fileName)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/api/v1/tickets", &body)
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return context
}

func TestParseTicketCreateRequestWithImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
	request, attachments, err := parseTicketCreateRequest(
		multipartTicketContext(t, 1, `C:\photos\incident.png`, png),
	)
	if err != nil {
		t.Fatalf("parseTicketCreateRequest() error = %v", err)
	}
	if request.Title != "Écran cassé" || request.Category != "HARDWARE" {
		t.Fatalf("unexpected request fields: %+v", request)
	}
	if len(attachments) != 1 || attachments[0].FileName != "incident.png" || attachments[0].ContentType != "image/png" {
		t.Fatalf("unexpected attachments: %+v", attachments)
	}
}

func TestParseTicketCreateRequestRejectsUnsupportedImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	_, _, err := parseTicketCreateRequest(
		multipartTicketContext(t, 1, "notes.txt", []byte("not an image")),
	)
	if err == nil || !strings.Contains(err.Error(), "JPEG, PNG, GIF ou WebP") {
		t.Fatalf("expected unsupported image error, got %v", err)
	}
}

func TestParseTicketCreateRequestLimitsImageCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
	_, _, err := parseTicketCreateRequest(multipartTicketContext(t, maxTicketImageCount+1, "image.png", png))
	if err == nil || !strings.Contains(err.Error(), "cinq images maximum") {
		t.Fatalf("expected image-count error, got %v", err)
	}
}
