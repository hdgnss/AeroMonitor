package notification

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"strconv"
	"strings"
)

type NotificationType string

const (
	TypeSlack NotificationType = "slack"
	TypeBark  NotificationType = "bark"
	TypeEmail NotificationType = "email"
	TypeTeams NotificationType = "teams"
)

type Config struct {
	Type   NotificationType `json:"type"`
	Config json.RawMessage  `json:"config"`
}

type TeamsConfig struct {
	WebhookURL string `json:"webhook_url"`
}

type SlackConfig struct {
	WebhookURL string `json:"webhook_url"`
}

type BarkConfig struct {
	URL string `json:"url"` // Full link like https://bark.host/key/title/body
}

type EmailConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	To       string `json:"to"`
}

func SendNotification(notifType string, configRaw string, title, message string, extra map[string]string) error {
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(configRaw), &config); err != nil {
		return fmt.Errorf("failed to parse config: %v", err)
	}

	switch notifType {
	case "slack":
		if url, ok := config["webhook_url"].(string); ok {
			return sendSlack(url, title, message)
		}
	case "bark":
		if url, ok := config["url"].(string); ok {
			return sendBark(url, title, message)
		}
	case "teams":
		if url, ok := config["webhook_url"].(string); ok {
			return sendTeams(url, title, message, extra)
		}
	case "email":
		return sendEmail(config, title, message)
	}
	return nil
}

func sendTeams(webhookURL, title, message string, extra map[string]string) error {
	link := extra["link"]
	info := extra["info"]

	payload := map[string]interface{}{
		"type": "message",
		"attachments": []map[string]interface{}{
			{
				"contentType": "application/vnd.microsoft.card.adaptive",
				"content": map[string]interface{}{
					"type": "AdaptiveCard",
					"body": []map[string]interface{}{
						{
							"type":    "Container",
							"style":   "accent",
							"padding": "Default",
							"spacing": "None",
							"items": []map[string]interface{}{
								{
									"type":   "TextBlock",
									"size":   "Large",
									"weight": "Bolder",
									"color":  "Dark",
									"text":   title,
									"style":  "heading",
								},
							},
						},
						{
							"type":    "Container",
							"padding": map[string]string{"top": "Default", "bottom": "None", "left": "Default", "right": "Default"},
							"spacing": "None",
							"items": []map[string]interface{}{
								{
									"type": "FactSet",
									"facts": []map[string]string{
										{"title": "Reason:", "value": message},
										{"title": "Link:", "value": link},
										{"title": "Info:", "value": info},
									},
								},
							},
						},
					},
					"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
					"version": "1.0",
					"padding": "None",
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	log.Printf("Sending Teams payload to %s: %s", webhookURL, string(body))
	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("Teams notification failed. Status: %d, Body: %s", resp.StatusCode, string(respBody))
		return fmt.Errorf("teams returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func sendSlack(webhookURL, title, message string) error {
	payload := map[string]interface{}{
		"text": fmt.Sprintf("*%s*\n%s", title, message),
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("slack returned status %d", resp.StatusCode)
	}
	return nil
}

func sendBark(baseURL, title, message string) error {
	// Ensure title and message are URL encoded as they are part of the path
	encodedTitle := url.PathEscape(title)
	encodedMessage := url.PathEscape(message)
	fullURL := fmt.Sprintf("%s/%s/%s", baseURL, encodedTitle, encodedMessage)

	resp, err := http.Get(fullURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bark returned status %d", resp.StatusCode)
	}
	return nil
}

func sendEmail(config map[string]interface{}, title, message string) error {
	host, _ := config["host"].(string)
	portVal := config["port"]
	username, _ := config["username"].(string)
	password, _ := config["password"].(string)
	from, _ := config["from"].(string)
	to, _ := config["to"].(string)

	if host == "" || to == "" {
		return fmt.Errorf("invalid email config: host and to are required")
	}

	var port int
	switch v := portVal.(type) {
	case float64:
		port = int(v)
	case int:
		port = v
	case string:
		if p, err := strconv.Atoi(v); err == nil {
			port = p
		} else {
			port = 25
		}
	default:
		port = 25
	}

	auth := smtp.PlainAuth("", username, password, host)
	toAddr := []string{to}

	// Parse "From" address to handle "Name <email>" format
	// The envelope sender must be just the email address
	envelopeFrom := from
	if addr, err := mail.ParseAddress(from); err == nil {
		envelopeFrom = addr.Address
	}

	// Sanitize subject to prevent header injection
	safeTitle := strings.ReplaceAll(title, "\r", "")
	safeTitle = strings.ReplaceAll(safeTitle, "\n", "")

	// Construct message with From header (supported by most clients to show Name)
	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n", from, to, safeTitle)
	msg := []byte(headers + "\r\n" + message + "\r\n")

	addr := fmt.Sprintf("%s:%d", host, port)

	// Use the stripped envelopeFrom for the SMTP transaction
	return smtp.SendMail(addr, auth, envelopeFrom, toAddr, msg)
}
