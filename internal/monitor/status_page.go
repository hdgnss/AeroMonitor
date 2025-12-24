package monitor

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type StatusPage struct {
	ID           string `db:"id" json:"id"`
	Name         string `db:"name" json:"name"`
	Slug         string `db:"slug" json:"slug"`
	Monitors     string `db:"monitors" json:"monitors"` // JSON array
	IsPublic     bool   `db:"is_public" json:"is_public"`
	PasswordHash string `db:"password_hash" json:"-"`
}

type StatusPageResponse struct {
	StatusPage
	Monitors []MonitorStatus `json:"monitors"`
}

type MonitorStatus struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Type    MonitorType `json:"type"`
	Status  string      `json:"status"`
	Uptime  float64     `json:"uptime"`
	History []int       `json:"history"` // Last 24h status: 1 for up, 0 for down
}

func (e *Engine) RegisterStatusPageRoutes(api *echo.Group) {
	api.GET("/status-pages", e.listStatusPages)
	api.POST("/status-pages", e.createStatusPage)
	api.GET("/status-pages/:slug", e.getStatusPage)
}

func (e *Engine) listStatusPages(c echo.Context) error {
	var pages []StatusPage
	err := e.db.Select(&pages, "SELECT * FROM status_pages")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, pages)
}

func (e *Engine) createStatusPage(c echo.Context) error {
	p := new(StatusPage)
	if err := c.Bind(p); err != nil {
		return err
	}
	p.ID = uuid.New().String()
	_, err := e.db.NamedExec(`INSERT INTO status_pages (id, name, slug, monitors, is_public, password_hash) 
		VALUES (:id, :name, :slug, :monitors, :is_public, :password_hash)`, p)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, p)
}

func (e *Engine) getStatusPage(c echo.Context) error {
	slug := c.Param("slug")
	var p StatusPage
	err := e.db.Get(&p, "SELECT * FROM status_pages WHERE slug = ?", slug)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Status page not found"})
	}

	var monitorIDs []string
	json.Unmarshal([]byte(p.Monitors), &monitorIDs)

	var monitorsData []MonitorStatus
	for _, id := range monitorIDs {
		var m Monitor
		if err := e.db.Get(&m, "SELECT * FROM monitors WHERE id = ?", id); err != nil {
			continue
		}

		var lastHeartbeat Heartbeat
		e.db.Get(&lastHeartbeat, "SELECT status FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 1", id)

		// Calculate uptime (last 24h)
		var upCount, totalCount int
		e.db.Get(&totalCount, "SELECT COUNT(*) FROM heartbeats WHERE monitor_id = ? AND timestamp > DATETIME('now', '-24 hours')", id)
		e.db.Get(&upCount, "SELECT COUNT(*) FROM heartbeats WHERE monitor_id = ? AND status = 'up' AND timestamp > DATETIME('now', '-24 hours')", id)

		uptime := 100.0
		if totalCount > 0 {
			uptime = (float64(upCount) / float64(totalCount)) * 100
		}

		monitorsData = append(monitorsData, MonitorStatus{
			ID:     m.ID,
			Name:   m.Name,
			Type:   m.Type,
			Status: lastHeartbeat.Status,
			Uptime: uptime,
		})
	}

	return c.JSON(http.StatusOK, StatusPageResponse{
		StatusPage: p,
		Monitors:   monitorsData,
	})
}
