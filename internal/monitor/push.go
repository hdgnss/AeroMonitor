package monitor

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (e *Engine) RegisterPushRoutes(api *echo.Group) {
	api.GET("/push/:id", e.handlePush)
	api.POST("/push/:id", e.handlePush)
}

func (e *Engine) handlePush(c echo.Context) error {
	id := c.Param("id")

	// Get monitor to check for token in metadata
	var m Monitor
	err := e.db.Get(&m, "SELECT * FROM monitors WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Monitor not found"})
	}

	// Check pushing auth if token is set in metadata
	var metadata struct {
		PushToken string `json:"push_token"`
	}
	if err := json.Unmarshal([]byte(m.Metadata), &metadata); err == nil && metadata.PushToken != "" {
		authHeader := c.Request().Header.Get("Authorization")
		expectedHeader := "Bearer " + metadata.PushToken
		if authHeader != expectedHeader {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or missing push token"})
		}
	}

	status := c.QueryParam("status")
	msg := c.QueryParam("msg")

	// Collect all other query parameters as custom data
	data := make(map[string]interface{})
	params := c.QueryParams()
	for k, v := range params {
		if k == "status" || k == "msg" {
			continue
		}
		if len(v) > 0 {
			data[k] = v[0]
		}
	}

	dataJSON, _ := json.Marshal(data)

	// Extract latency from 'ping' query parameter if available
	var latency int
	if p := c.QueryParam("ping"); p != "" {
		fmt.Sscanf(p, "%d", &latency)
	}

	// Save the heartbeat
	res := Result{
		MonitorID: id,
		Status:    status,
		Message:   msg,
		Data:      string(dataJSON),
		Latency:   latency,
	}

	e.saveResult(res)

	return c.String(http.StatusOK, "OK")
}
