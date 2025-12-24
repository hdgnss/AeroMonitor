package auth

import (
	"aeromonitor/internal/settings"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	Settings *settings.Service
}

func NewAuthHandler(s *settings.Service) *AuthHandler {
	return &AuthHandler{Settings: s}
}

func (h *AuthHandler) getProvider() *OIDCProvider {
	if !h.Settings.IsOIDCConfigured() {
		return nil
	}

	return NewOIDCProvider(
		h.Settings.Get(settings.KeyOIDCClientID),
		h.Settings.Get(settings.KeyOIDCClientSecret),
		h.Settings.Get(settings.KeyOIDCRedirectURL),
		h.Settings.Get(settings.KeyOIDCAuthURL),
		h.Settings.Get(settings.KeyOIDCTokenURL),
		h.Settings.Get(settings.KeyOIDCUserInfoURL),
	)
}

func (h *AuthHandler) Login(c echo.Context) error {
	provider := h.getProvider()
	if provider == nil {
		return c.String(http.StatusServiceUnavailable, "OIDC is not configured")
	}

	state := GenerateRandomString(16)

	// Secure cookie for state
	cookie := new(http.Cookie)
	cookie.Name = "oauth_state"
	cookie.Value = state
	cookie.Expires = time.Now().Add(10 * time.Minute)
	cookie.HttpOnly = true
	cookie.Path = "/"
	c.SetCookie(cookie)

	url := provider.GetAuthURL(state)
	return c.Redirect(http.StatusTemporaryRedirect, url)
}

func (h *AuthHandler) PasswordLogin(c echo.Context) error {
	if !h.Settings.GetBool(settings.KeyAllowPasswordAuth) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Password authentication is disabled"})
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Fetch admin credentials from settings
	adminUser := h.Settings.Get(settings.KeyAdminUser)
	adminPassHash := h.Settings.Get(settings.KeyAdminPass)

	if adminUser == "" || adminPassHash == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Admin account not configured"})
	}

	if req.Username != adminUser {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(adminPassHash), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	jwt, err := GenerateJWT(adminUser, "Administrator", "admin", "")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	authCookie := new(http.Cookie)
	authCookie.Name = "auth_token"
	authCookie.Value = jwt
	authCookie.Expires = time.Now().Add(24 * time.Hour)
	authCookie.HttpOnly = true
	authCookie.Path = "/"
	c.SetCookie(authCookie)

	return c.JSON(http.StatusOK, map[string]string{"message": "Login successful"})
}

func (h *AuthHandler) Callback(c echo.Context) error {
	provider := h.getProvider()
	if provider == nil {
		return c.String(http.StatusServiceUnavailable, "OIDC is not configured")
	}

	state := c.QueryParam("state")
	code := c.QueryParam("code")

	// Verify state
	cookie, err := c.Cookie("oauth_state")
	if err != nil || cookie.Value != state {
		return c.String(http.StatusBadRequest, "Invalid state")
	}

	// Exchange code for token
	token, err := provider.Exchange(code)
	if err != nil {
		return c.String(http.StatusInternalServerError, "Failed to exchange token")
	}

	// Get user info
	userInfo, err := provider.GetUserInfo(token)
	if err != nil {
		return c.String(http.StatusInternalServerError, "Failed to get user info")
	}

	// Generate JWT
	role := "user"
	for _, g := range userInfo.Groups {
		if g == "admin" {
			role = "admin"
			break
		}
	}

	jwt, err := GenerateJWT(userInfo.Email, userInfo.Name, role, userInfo.Picture)
	if err != nil {
		return c.String(http.StatusInternalServerError, "Failed to generate JWT")
	}

	// Set JWT cookie
	authCookie := new(http.Cookie)
	authCookie.Name = "auth_token"
	authCookie.Value = jwt
	authCookie.Expires = time.Now().Add(24 * time.Hour)
	authCookie.HttpOnly = true
	authCookie.Path = "/"
	c.SetCookie(authCookie)

	// Redirect to dashboard
	return c.Redirect(http.StatusTemporaryRedirect, "/")
}

func (h *AuthHandler) Logout(c echo.Context) error {
	cookie := new(http.Cookie)
	cookie.Name = "auth_token"
	cookie.Value = ""
	cookie.Expires = time.Now().Add(-1 * time.Hour)
	cookie.HttpOnly = true
	cookie.Path = "/"
	c.SetCookie(cookie)

	return c.Redirect(http.StatusTemporaryRedirect, "/login")
}

func (h *AuthHandler) GetUser(c echo.Context) error {
	cookie, err := c.Cookie("auth_token")
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	claims, err := ValidateJWT(cookie.Value)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"id":           claims.UserID,
		"name":         claims.Name,
		"display_name": claims.Name, // Explicitly provide as display_name for clarity
		"role":         claims.Role,
		"email":        claims.UserID,
		"picture":      claims.Picture,
	})
}
