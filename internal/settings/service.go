package settings

import (
	"log"
	"os"
	"sync"

	"github.com/jmoiron/sqlx"
)

// Supported Setting Keys
const (
	KeyAllowPasswordAuth = "allow_password_auth"
	KeyOIDCEnabled       = "oidc_enabled"
	KeyOIDCClientID      = "oidc_client_id"
	KeyOIDCClientSecret  = "oidc_client_secret"
	KeyOIDCRedirectURL   = "oidc_redirect_url"
	KeyOIDCAuthURL       = "oidc_auth_url"
	KeyOIDCTokenURL      = "oidc_token_url"
	KeyOIDCUserInfoURL   = "oidc_userinfo_url"
	KeyAppTitle          = "app_title"
	KeyAppLogoURL        = "app_logo_url"
	KeyAdminUser         = "admin_user"
	KeyAdminPass         = "admin_pass"
	KeyAdminEmail        = "admin_email"
	KeyAPIBearerToken    = "api_bearer_token"
)

// Env Var Mapping
var envMapping = map[string]string{
	"ALLOW_PASSWORD_AUTH": KeyAllowPasswordAuth,
	"OIDC_ENABLED":        KeyOIDCEnabled,
	"OIDC_CLIENT_ID":      KeyOIDCClientID,
	"OIDC_CLIENT_SECRET":  KeyOIDCClientSecret,
	"OIDC_REDIRECT_URL":   KeyOIDCRedirectURL,
	"OIDC_AUTH_URL":       KeyOIDCAuthURL,
	"OIDC_TOKEN_URL":      KeyOIDCTokenURL,
	"OIDC_USERINFO_URL":   KeyOIDCUserInfoURL,
}

type Service struct {
	db    *sqlx.DB
	cache map[string]string
	mu    sync.RWMutex
}

func NewService(db *sqlx.DB) *Service {
	s := &Service{
		db:    db,
		cache: make(map[string]string),
	}
	s.loadSettings()
	return s
}

func (s *Service) loadSettings() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Load from DB
	var settings []struct {
		Key   string `db:"key"`
		Value string `db:"value"`
	}
	err := s.db.Select(&settings, "SELECT key, value FROM settings")
	if err != nil {
		log.Printf("Failed to load settings: %v", err)
		return
	}

	for _, setting := range settings {
		s.cache[setting.Key] = setting.Value
	}

	// 2. Check Env Vars - Only set if missing in DB
	for envKey, settingKey := range envMapping {
		envVal := os.Getenv(envKey)
		if envVal != "" {
			// Check if setting exists in DB/Cache
			if _, exists := s.cache[settingKey]; !exists {
				log.Printf("Initializing setting %s from environment variable %s", settingKey, envKey)
				// Persist to DB
				_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", settingKey, envVal)
				if err != nil {
					log.Printf("Failed to persist env setting %s: %v", settingKey, err)
					continue
				}
				s.cache[settingKey] = envVal
			}
		}
	}
	// 3. Safety check: If admin user exists but no auth method is enabled, enable password auth
	if s.cache[KeyAdminUser] != "" && s.cache[KeyAllowPasswordAuth] != "true" && s.cache[KeyOIDCEnabled] != "true" {
		log.Printf("Admin user exists but no authentication method is enabled. Enabling password authentication by default.")
		s.cache[KeyAllowPasswordAuth] = "true"
		// Best effort persist to DB
		s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", KeyAllowPasswordAuth, "true")
	}
}

func (s *Service) Get(key string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cache[key]
}

func (s *Service) GetBool(key string) bool {
	val := s.Get(key)
	return val == "true"
}

func (s *Service) Set(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	if err != nil {
		return err
	}

	s.cache[key] = value
	return nil
}

func (s *Service) GetAll() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copy := make(map[string]string)
	for k, v := range s.cache {
		copy[k] = v
	}
	return copy
}

func (s *Service) SetAll(settings map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	for k, v := range settings {
		_, err := tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v)
		if err != nil {
			tx.Rollback()
			return err
		}
		s.cache[k] = v
	}

	return tx.Commit()
}

// Helper to check if OIDC is fully configured
func (s *Service) IsOIDCConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	required := []string{
		KeyOIDCClientID,
		// KeyOIDCClientSecret, // Optional
		KeyOIDCRedirectURL,
		KeyOIDCAuthURL,
		KeyOIDCTokenURL,
		KeyOIDCUserInfoURL,
	}

	for _, k := range required {
		if s.cache[k] == "" {
			return false
		}
	}
	return s.GetBool(KeyOIDCEnabled)
}
