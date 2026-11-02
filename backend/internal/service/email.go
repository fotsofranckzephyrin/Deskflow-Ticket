package service

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type SMTPEmailSender struct {
	host string
	port string
	user string
	pass string
	from string
}

func NewSMTPEmailSender() *SMTPEmailSender {
	return &SMTPEmailSender{
		host: strings.TrimSpace(os.Getenv("SMTP_HOST")),
		port: strings.TrimSpace(os.Getenv("SMTP_PORT")),
		user: os.Getenv("SMTP_USER"),
		pass: os.Getenv("SMTP_PASSWORD"),
		from: strings.TrimSpace(os.Getenv("SMTP_FROM")),
	}
}

func (s *SMTPEmailSender) Send(to, subject, body string) error {
	if s.host == "" || s.from == "" {
		return fmt.Errorf("SMTP_HOST et SMTP_FROM doivent être configurés pour envoyer des e-mails")
	}
	port := s.port
	if port == "" {
		port = "587"
	}
	from, err := mail.ParseAddress(s.from)
	if err != nil {
		return fmt.Errorf("SMTP_FROM invalide: %w", err)
	}
	recipient, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("adresse du destinataire invalide: %w", err)
	}
	message := []byte("From: " + s.from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body + "\r\n")
	address := net.JoinHostPort(s.host, port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	var conn net.Conn
	if port == "465" {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{
			ServerName: s.host,
			MinVersion: tls.VersionTLS12,
		})
	} else {
		conn, err = dialer.Dial("tcp", address)
	}
	if err != nil {
		return fmt.Errorf("connexion SMTP impossible: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("initialisation SMTP impossible: %w", err)
	}
	defer client.Close()
	if port != "465" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("le serveur SMTP ne propose pas STARTTLS")
		}
		if err := client.StartTLS(&tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("négociation STARTTLS impossible: %w", err)
		}
	}
	if s.user != "" {
		if s.pass == "" {
			return fmt.Errorf("SMTP_PASSWORD doit être renseigné avec SMTP_USER")
		}
		if err := client.Auth(smtp.PlainAuth("", s.user, s.pass, s.host)); err != nil {
			return fmt.Errorf("authentification SMTP impossible: %w", err)
		}
	}
	if err := client.Mail(from.Address); err != nil {
		return fmt.Errorf("expéditeur SMTP refusé: %w", err)
	}
	if err := client.Rcpt(recipient.Address); err != nil {
		return fmt.Errorf("destinataire SMTP refusé: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("préparation du message SMTP impossible: %w", err)
	}
	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return fmt.Errorf("écriture du message SMTP impossible: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("envoi de l'e-mail impossible: %w", err)
	}
	return nil
}
