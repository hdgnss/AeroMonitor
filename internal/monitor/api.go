package monitor

import (
	"aeromonitor/internal/notification"
	"aeromonitor/internal/settings"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func (e *Engine) RegisterPublicMonitorRoutes(api *echo.Group) {
	api.GET("/monitors", e.listMonitors)
	api.GET("/monitors/:id", e.getMonitor)
	api.GET("/monitors/:id/heartbeats", e.getHeartbeats)
}

func (e *Engine) RegisterExportRoutes(api *echo.Group) {
	api.GET("/monitors/:id/export", e.exportMonitorData)
}

func (e *Engine) RegisterStatusRoutes(api *echo.Group) {
	api.GET("/status/:id", e.getMonitorStatus)
}

func (e *Engine) RegisterAdminMonitorRoutes(api *echo.Group) {
	api.POST("/monitors", e.createMonitor)
	api.PUT("/monitors/:id", e.updateMonitor)
	api.DELETE("/monitors/:id", e.deleteMonitor)
	api.DELETE("/monitors/:id/heartbeats", e.clearMonitorHistory)
	api.PUT("/monitors/:id/pause", e.pauseMonitor)
	api.PUT("/monitors/:id/resume", e.resumeMonitor)

	// Notifications
	api.GET("/notifications", e.listNotifications)
	api.POST("/notifications", e.createNotification)
	api.PUT("/notifications/:id", e.updateOrCreateNotification)
	api.DELETE("/notifications/:id", e.deleteNotificationChannel)
	api.POST("/notifications/test", e.testNotification)
}

func (e *Engine) listNotifications(c echo.Context) error {
	var list []struct {
		ID     string `db:"id" json:"id"`
		Name   string `db:"name" json:"name"`
		Type   string `db:"type" json:"type"`
		Config string `db:"config" json:"config"`
	}
	err := e.db.Select(&list, "SELECT id, name, type, config FROM notifications")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func (e *Engine) createNotification(c echo.Context) error {
	var n struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		Config string `json:"config"`
	}
	if err := c.Bind(&n); err != nil {
		return err
	}
	id := uuid.New().String()
	_, err := e.db.Exec("INSERT INTO notifications (id, name, type, config) VALUES (?, ?, ?, ?)", id, n.Name, n.Type, n.Config)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id})
}

func (e *Engine) testNotification(c echo.Context) error {
	var n struct {
		Type   string `json:"type"`
		Config string `json:"config"`
	}
	if err := c.Bind(&n); err != nil {
		return err
	}

	appTitle := e.getAppTitle()
	err := notification.SendNotification(n.Type, n.Config, fmt.Sprintf("%s Test", appTitle), fmt.Sprintf("This is a test notification from %s.", appTitle), map[string]string{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (e *Engine) updateOrCreateNotification(c echo.Context) error {
	id := c.Param("id")
	var n struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		Config string `json:"config"`
	}
	if err := c.Bind(&n); err != nil {
		return err
	}

	_, err := e.db.Exec(`
		INSERT INTO notifications (id, name, type, config) 
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET 
			name = excluded.name,
			type = excluded.type,
			config = excluded.config
	`, id, n.Name, n.Type, n.Config)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusOK)
}

func (e *Engine) deleteNotificationChannel(c echo.Context) error {
	id := c.Param("id")

	// Delete associations first
	_, err := e.db.Exec("DELETE FROM monitor_notifications WHERE notification_id = ?", id)
	if err != nil {
		log.Printf("Failed to delete notification associations: %v", err)
		// Continue to delete the notification itself even if associations failed
	}

	_, err = e.db.Exec("DELETE FROM notifications WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

type MonitorListItem struct {
	Monitor
	Status  string  `json:"status"`
	Latency int     `json:"latency"`
	Uptime  float64 `json:"uptime"`
}

func (e *Engine) listMonitors(c echo.Context) error {
	var monitors []Monitor
	err := e.db.Select(&monitors, "SELECT * FROM monitors")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	var list []MonitorListItem
	for _, m := range monitors {
		var status string
		var latency int
		var upCount, totalCount int

		e.db.Get(&status, "SELECT status FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 1", m.ID)
		e.db.Get(&latency, "SELECT latency FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 1", m.ID)

		// 24h uptime
		e.db.Get(&totalCount, "SELECT COUNT(*) FROM heartbeats WHERE monitor_id = ? AND timestamp > DATETIME('now', '-24 hours')", m.ID)
		e.db.Get(&upCount, "SELECT COUNT(*) FROM heartbeats WHERE monitor_id = ? AND status = 'up' AND timestamp > DATETIME('now', '-24 hours')", m.ID)

		uptime := 100.0
		if totalCount > 0 {
			uptime = (float64(upCount) / float64(totalCount)) * 100
		}

		if status == "" {
			status = "unknown"
		}

		list = append(list, MonitorListItem{
			Monitor: m,
			Status:  status,
			Latency: latency,
			Uptime:  uptime,
		})
	}

	return c.JSON(http.StatusOK, list)
}

func (e *Engine) createMonitor(c echo.Context) error {
	var req struct {
		Monitor
		NotificationIDs []string `json:"notification_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	m := req.Monitor
	m.ID = uuid.New().String()

	tx, err := e.db.Beginx()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.NamedExec(`INSERT INTO monitors (id, owner_id, name, type, target, interval, notification_channels, metadata, monitor_group) 
		VALUES (:id, :owner_id, :name, :type, :target, :interval, :notification_channels, :metadata, :monitor_group)`, m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	for _, nid := range req.NotificationIDs {
		_, err = tx.Exec("INSERT INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)", m.ID, nid)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, m)
}

func (e *Engine) getMonitor(c echo.Context) error {
	id := c.Param("id")
	var m Monitor
	err := e.db.Get(&m, "SELECT * FROM monitors WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Monitor not found"})
	}

	var nids []string
	e.db.Select(&nids, "SELECT notification_id FROM monitor_notifications WHERE monitor_id = ?", id)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"monitor":          m,
		"notification_ids": nids,
	})
}

func (e *Engine) updateMonitor(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Monitor
		NotificationIDs []string `json:"notification_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return err
	}
	m := req.Monitor
	m.ID = id

	tx, err := e.db.Beginx()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.NamedExec(`UPDATE monitors SET name=:name, target=:target, interval=:interval, 
		notification_channels=:notification_channels, metadata=:metadata, monitor_group=:monitor_group WHERE id=:id`, m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Update notifications
	_, err = tx.Exec("DELETE FROM monitor_notifications WHERE monitor_id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	for _, nid := range req.NotificationIDs {
		_, err = tx.Exec("INSERT INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)", id, nid)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, m)
}

func (e *Engine) deleteMonitor(c echo.Context) error {
	id := c.Param("id")
	_, err := e.db.Exec("DELETE FROM monitors WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (e *Engine) getHeartbeats(c echo.Context) error {
	id := c.Param("id")
	var heartbeats []Heartbeat
	// Increase limit to accommodate 7 days of data (approx 30k points at 20s interval)
	err := e.db.Select(&heartbeats, "SELECT id, monitor_id, status, latency, COALESCE(message, '') as message, COALESCE(data, '{}') as data, timestamp FROM heartbeats WHERE monitor_id = ? AND timestamp > DATETIME('now', '-7 days') ORDER BY timestamp DESC", id)
	if err != nil {
		log.Printf("[API ERROR] Failed to fetch heartbeats for %s: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, heartbeats)
}

func (e *Engine) clearMonitorHistory(c echo.Context) error {
	id := c.Param("id")
	_, err := e.db.Exec("DELETE FROM heartbeats WHERE monitor_id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (e *Engine) pauseMonitor(c echo.Context) error {
	id := c.Param("id")
	_, err := e.db.Exec("UPDATE monitors SET paused = 1 WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "paused"})
}

func (e *Engine) resumeMonitor(c echo.Context) error {
	id := c.Param("id")
	_, err := e.db.Exec("UPDATE monitors SET paused = 0 WHERE id = ?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "resumed"})
}

func (e *Engine) exportMonitorData(c echo.Context) error {
	id := c.Param("id")
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")

	// Check Bearer Token
	configuredToken := e.settings.Get(settings.KeyAPIBearerToken)
	if configuredToken != "" {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			// Also check for query param "token" for easier browser download
			queryToken := c.QueryParam("token")
			if queryToken == "" || queryToken != configuredToken {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing or invalid authorization header/token"})
			}
		} else {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if token != configuredToken {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
			}
		}
	}

	// Default to last 30 days if not provided
	start := time.Now().UTC().AddDate(0, 0, -30)
	end := time.Now().UTC()

	if startStr != "" {
		if t, err := time.Parse("2006-01-02T15:04", startStr); err == nil {
			start = t
		} else if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			start = t
		}
	}
	if endStr != "" {
		if t, err := time.Parse("2006-01-02T15:04", endStr); err == nil {
			end = t
		} else if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			end = t
		}
	}

	var heartbeats []Heartbeat
	err := e.db.Select(&heartbeats, "SELECT id, monitor_id, status, latency, COALESCE(message, '') as message, COALESCE(data, '{}') as data, timestamp FROM heartbeats WHERE monitor_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC", id, start, end)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// 1. First pass: Collect all unique keys from Data JSON
	uniqueKeys := make(map[string]bool)
	parsedData := make([]map[string]interface{}, len(heartbeats))

	for i, h := range heartbeats {
		var dataMap map[string]interface{}
		if h.Data != "" {
			if err := json.Unmarshal([]byte(h.Data), &dataMap); err == nil {
				parsedData[i] = dataMap
				for k := range dataMap {
					uniqueKeys[k] = true
				}
			}
		}
	}

	// Sort keys for consistent CSV structure
	var sortedKeys []string
	for k := range uniqueKeys {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	c.Response().Header().Set(echo.HeaderContentType, "text/csv")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"monitor_%s_export.csv\"", id))

	w := csv.NewWriter(c.Response().Writer)

	// Write Header
	header := []string{"Timestamp", "Status", "Latency (ms)", "Message"}
	header = append(header, sortedKeys...)

	if err := w.Write(header); err != nil {
		return err
	}

	// Write Rows
	for i, h := range heartbeats {
		record := []string{
			h.Timestamp.Format(time.RFC3339),
			h.Status,
			fmt.Sprintf("%d", h.Latency),
			h.Message,
		}

		// Append dynamic data columns
		dataMap := parsedData[i]
		for _, key := range sortedKeys {
			if val, ok := dataMap[key]; ok {
				record = append(record, fmt.Sprintf("%v", val))
			} else {
				record = append(record, "")
			}
		}

		if err := w.Write(record); err != nil {
			return err
		}
	}
	w.Flush()
	return nil
}

func (e *Engine) getMonitorStatus(c echo.Context) error {
	id := c.Param("id")

	// 1. Check Bearer Token
	configuredToken := e.settings.Get(settings.KeyAPIBearerToken)
	if configuredToken != "" {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing or invalid authorization header"})
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token != configuredToken {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
		}
	}

	// 2. Fetch Latest Heartbeat and Monitor Type
	var h struct {
		Type      string    `db:"type"`
		Status    string    `db:"status"`
		Latency   int       `db:"latency"`
		Data      string    `db:"data"`
		Timestamp time.Time `db:"timestamp"`
	}
	err := e.db.Get(&h, `
		SELECT m.type, h.status, h.latency, COALESCE(h.data, '{}') as data, h.timestamp 
		FROM heartbeats h
		JOIN monitors m ON h.monitor_id = m.id
		WHERE h.monitor_id = ? 
		ORDER BY h.timestamp DESC LIMIT 1`, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Monitor not found or no data available"})
	}

	// 3. Prepare Response
	response := map[string]interface{}{
		"id":        id,
		"status":    h.Status,
		"timestamp": h.Timestamp.Format(time.RFC3339),
	}

	if h.Status == "up" {
		if h.Type == string(TypePush) {
			var jsonData interface{}
			if err := json.Unmarshal([]byte(h.Data), &jsonData); err == nil {
				response["data"] = jsonData
			} else {
				response["data"] = h.Data
			}
		} else {
			response["data"] = map[string]interface{}{
				"latency": h.Latency,
			}
		}
	}

	return c.JSON(http.StatusOK, response)
}
