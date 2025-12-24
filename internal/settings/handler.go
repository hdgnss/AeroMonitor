package settings

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	Service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{Service: s}
}

func (h *Handler) GetSettings(c echo.Context) error {
	settings := h.Service.GetAll()
	return c.JSON(http.StatusOK, settings)
}

func (h *Handler) UpdateSettings(c echo.Context) error {
	var payload map[string]string
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Service.SetAll(payload); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save settings"})
	}

	return c.JSON(http.StatusOK, h.Service.GetAll())
}

func (h *Handler) GetPublicSettings(c echo.Context) error {
	settings := h.Service.GetAll()
	publicSettings := map[string]interface{}{
		"oidc_enabled":        settings[KeyOIDCEnabled] == "true",
		"allow_password_auth": settings[KeyAllowPasswordAuth] == "true",
		"app_title":           settings[KeyAppTitle],
		"app_logo_url":        settings[KeyAppLogoURL],
	}
	return c.JSON(http.StatusOK, publicSettings)
}
