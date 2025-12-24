package setup

import (
	"aeromonitor/internal/settings"
	"net/http"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	Settings *settings.Service
}

func NewHandler(s *settings.Service) *Handler {
	return &Handler{Settings: s}
}

func (h *Handler) GetStatus(c echo.Context) error {
	oidcEnabled := h.Settings.GetBool(settings.KeyOIDCEnabled)
	adminUser := h.Settings.Get(settings.KeyAdminUser)

	required := !oidcEnabled && adminUser == ""

	return c.JSON(http.StatusOK, map[string]bool{
		"required": required,
	})
}

type SetupRequest struct {
	SiteName      string `json:"site_name"`
	AdminUser     string `json:"admin_user"`
	AdminPassword string `json:"admin_password"`
	AdminEmail    string `json:"admin_email"`
}

func (h *Handler) Setup(c echo.Context) error {
	// Security check: if setup is not required, forbid access
	oidcEnabled := h.Settings.GetBool(settings.KeyOIDCEnabled)
	existingAdmin := h.Settings.Get(settings.KeyAdminUser)

	if oidcEnabled || existingAdmin != "" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Setup is already completed or not required"})
	}

	var req SetupRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.AdminUser == "" || req.AdminPassword == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username and password are required"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	// Save settings
	updates := map[string]string{
		settings.KeyAppTitle:   req.SiteName,
		settings.KeyAdminUser:  req.AdminUser,
		settings.KeyAdminPass:  string(hashedPassword),
		settings.KeyAdminEmail: req.AdminEmail,
	}

	if err := h.Settings.SetAll(updates); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save settings"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Setup completed successfully"})
}
