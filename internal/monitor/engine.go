package monitor

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"aeromonitor/internal/notification"
	"aeromonitor/internal/settings"

	"github.com/jmoiron/sqlx"
)

type Engine struct {
	db         *sqlx.DB
	settings   *settings.Service
	monitors   map[string]*Monitor
	status     map[string]string // monitorID -> "up"/"down"
	lastChecks map[string]time.Time
	httpClient *http.Client
	mu         sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewEngine(db *sqlx.DB, s *settings.Service) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{
		db:         db,
		settings:   s,
		monitors:   make(map[string]*Monitor),
		status:     make(map[string]string),
		lastChecks: make(map[string]time.Time),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		ctx:    ctx,
		cancel: cancel,
	}
}

func (e *Engine) Start() {
	log.Println("Monitoring engine starting...")
	e.loadInitialStatus()
	go e.scheduler()
}

func (e *Engine) loadInitialStatus() {
	var results []struct {
		MonitorID string `db:"monitor_id"`
		Status    string `db:"status"`
	}
	// Fetch the latest status for each monitor
	query := `
		SELECT h1.monitor_id, h1.status 
		FROM heartbeats h1
		JOIN (
			SELECT monitor_id, MAX(timestamp) as max_ts 
			FROM heartbeats 
			GROUP BY monitor_id
		) h2 ON h1.monitor_id = h2.monitor_id AND h1.timestamp = h2.max_ts
	`
	err := e.db.Select(&results, query)
	if err != nil {
		log.Printf("Failed to load initial status: %v", err)
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	for _, r := range results {
		e.status[r.MonitorID] = r.Status
	}
	log.Printf("Loaded initial status for %d monitors", len(results))
}

func (e *Engine) Stop() {
	e.cancel()
}

func (e *Engine) scheduler() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.runChecks()
		}
	}
}

func (e *Engine) runChecks() {
	var monitors []Monitor
	err := e.db.Select(&monitors, "SELECT * FROM monitors")
	if err != nil {
		log.Printf("Error fetching monitors: %v", err)
		return
	}

	for _, m := range monitors {
		if m.Paused {
			continue
		}
		if m.Type == TypePush {
			go e.checkPushTimeout(m)
		} else {
			e.mu.Lock()
			lastRun, ok := e.lastChecks[m.ID]
			now := time.Now().UTC()

			// Initialize fast check if new
			shouldRun := false
			if !ok {
				shouldRun = true
				e.lastChecks[m.ID] = now
			} else if int(now.Sub(lastRun).Seconds()) >= m.Interval {
				shouldRun = true
				e.lastChecks[m.ID] = now
			}
			e.mu.Unlock()

			if shouldRun {
				go e.checkMonitor(m)
			}
		}
	}
}

func (e *Engine) checkPushTimeout(m Monitor) {
	var lastTime time.Time
	err := e.db.Get(&lastTime, "SELECT timestamp FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 1", m.ID)

	isTimeout := false
	if err != nil {
		isTimeout = true
	} else {
		since := time.Now().UTC().Sub(lastTime)
		if since > (time.Duration(m.Interval)*time.Second + 5*time.Second) {
			isTimeout = true
		}
	}

	if isTimeout && !m.Paused {
		e.mu.RLock()
		currentStatus := e.status[m.ID]
		e.mu.RUnlock()

		if currentStatus != "down" {
			e.saveResult(Result{
				MonitorID: m.ID,
				Status:    "down",
				Message:   "Heartbeat timeout",
				Latency:   0,
			})
		}
	}
}

func (e *Engine) checkMonitor(m Monitor) {
	var result Result

	switch m.Type {
	case TypeHTTP:
		result = e.checkHTTP(m)
	case TypeTCP:
		result = e.checkTCP(m)
	case TypePing:
		result = e.checkPing(m)
	case TypeFileUpdate:
		result = e.checkFileUpdate(m)
	case TypePush:
		// Push monitors are passive, they don't run active checks
		return
	default:
		log.Printf("Unknown monitor type: %s", m.Type)
		return
	}

	e.saveResult(result)
}

func (e *Engine) checkHTTP(m Monitor) Result {
	start := time.Now().UTC()
	resp, err := e.httpClient.Get(m.Target)
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   latency,
			Message:   err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return Result{
			MonitorID: m.ID,
			Status:    "up",
			Latency:   latency,
			Message:   resp.Status,
		}
	}

	return Result{
		MonitorID: m.ID,
		Status:    "down",
		Latency:   latency,
		Message:   resp.Status,
	}
}

func (e *Engine) checkTCP(m Monitor) Result {
	start := time.Now().UTC()
	conn, err := net.DialTimeout("tcp", m.Target, 5*time.Second)
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   latency,
			Message:   err.Error(),
		}
	}
	defer conn.Close()

	return Result{
		MonitorID: m.ID,
		Status:    "up",
		Latency:   latency,
		Message:   "TCP Connection Successful",
	}
}

func (e *Engine) checkPing(m Monitor) Result {
	// Ping is actually harder to do in Go without root privileges in some OSs.
	// We can use a library or just use a simple ICMP implementation.
	// For now, let's use a simple TCP check on common ports as a fallback or a basic exec ping.
	// But to keep it "lightweight" and simple, I'll use a basic TCP check on port 80/443 if no port is specified.
	// Actually, let's try a system ping command for simplicity in this prototype.

	start := time.Now().UTC()
	cmd := exec.Command("ping", "-c", "1", "-t", "5", m.Target)
	err := cmd.Run()
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   latency,
			Message:   "Ping failed",
		}
	}

	return Result{
		MonitorID: m.ID,
		Status:    "up",
		Latency:   latency,
		Message:   "Ping successful",
	}
}

func (e *Engine) checkFileUpdate(m Monitor) Result {
	start := time.Now().UTC()

	// 1. Parse Metadata for Expected Interval
	expectedInterval := 15 * time.Minute // Default
	var metadata struct {
		ExpectedIntervalMinutes int `json:"expected_update_interval"`
	}
	if err := json.Unmarshal([]byte(m.Metadata), &metadata); err == nil && metadata.ExpectedIntervalMinutes > 0 {
		expectedInterval = time.Duration(metadata.ExpectedIntervalMinutes) * time.Minute
	}

	// 2. Fetch Last Heartbeat to get history
	var lastDataStr string
	var currentMD5 string

	// Get the last successful check's data
	e.db.Get(&lastDataStr, "SELECT data FROM heartbeats WHERE monitor_id = ? AND status = 'up' ORDER BY timestamp DESC LIMIT 1", m.ID)

	var lastData struct {
		CurrentMD5  string `json:"current_md5"`
		LastChanged string `json:"last_changed"`
	}
	if lastDataStr != "" {
		json.Unmarshal([]byte(lastDataStr), &lastData)
	}

	// 3. Download File
	req, err := http.NewRequest("GET", m.Target, nil)
	if err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   0,
			Message:   fmt.Sprintf("Request creation failed: %v", err),
		}
	}

	// Add Basic Auth if configured
	var authData struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal([]byte(m.Metadata), &authData); err == nil {
		if authData.Username != "" || authData.Password != "" {
			req.SetBasicAuth(authData.Username, authData.Password)
		}
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   0,
			Message:   fmt.Sprintf("Download failed: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   0,
			Message:   fmt.Sprintf("HTTP Error: %s", resp.Status),
		}
	}

	// 4. Calculate MD5
	hash := md5.New()
	if _, err := io.Copy(hash, resp.Body); err != nil {
		return Result{
			MonitorID: m.ID,
			Status:    "down",
			Latency:   0,
			Message:   fmt.Sprintf("Hashing failed: %v", err),
		}
	}
	currentMD5 = hex.EncodeToString(hash.Sum(nil))
	latency := int(time.Since(start).Milliseconds())

	// 5. Determine State
	now := time.Now().UTC()
	lastChangedTime := now // Default if new
	if lastData.LastChanged != "" {
		if t, err := time.Parse(time.RFC3339, lastData.LastChanged); err == nil {
			lastChangedTime = t
		}
	}

	status := "up"
	message := "File is fresh"

	if currentMD5 != lastData.CurrentMD5 {
		// File Changed! Update last changed time to NOW
		lastChangedTime = now
		message = "File updated recently"
	} else {
		// File NOT Changed. Check if it's stale
		// If we don't have a previous record (lastData.CurrentMD5 is empty), we consider it fresh as baseline
		if lastData.CurrentMD5 != "" {
			if now.Sub(lastChangedTime) > expectedInterval {
				status = "down"
				message = fmt.Sprintf("File stale! Not updated in %s", now.Sub(lastChangedTime).Round(time.Minute))
			} else {
				message = fmt.Sprintf("File valid. Last update: %s ago", now.Sub(lastChangedTime).Round(time.Minute))
			}
		} else {
			message = "New file monitoring started"
		}
	}

	// Prepare result data
	resultData := map[string]string{
		"current_md5":  currentMD5,
		"last_changed": lastChangedTime.Format(time.RFC3339),
	}
	dataBytes, _ := json.Marshal(resultData)

	return Result{
		MonitorID: m.ID,
		Status:    status,
		Latency:   latency,
		Message:   message,
		Data:      string(dataBytes),
	}
}

func (e *Engine) saveResult(res Result) {
	_, err := e.db.Exec(`
		INSERT INTO heartbeats (monitor_id, status, latency, message, data, timestamp)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, res.MonitorID, res.Status, res.Latency, res.Message, res.Data)
	if err != nil {
		log.Printf("Error saving heartbeat: %v", err)
	}

	// Update current status and trigger notifications
	e.mu.Lock()
	oldStatus := e.status[res.MonitorID]
	e.status[res.MonitorID] = res.Status
	e.mu.Unlock()

	// Notify if status changed
	// We allow notification if oldStatus is empty (new monitor or first run) ONLY if new status is DOWN.
	// We prevent noise by silencing the initial "Unknown -> Up" transition.
	if oldStatus != res.Status {
		if oldStatus == "" && res.Status == "up" {
			// Silent success on startup / first run
			return
		}
		e.notifyStatusChange(res.MonitorID, res.Status)
	}
}

func (e *Engine) getAppTitle() string {
	var title string
	err := e.db.Get(&title, "SELECT value FROM settings WHERE key = 'app_title'")
	if err != nil || title == "" {
		return "AeroMonitor"
	}
	return title
}

func (e *Engine) notifyStatusChange(monitorID string, status string) {
	var m Monitor
	if err := e.db.Get(&m, "SELECT * FROM monitors WHERE id = ?", monitorID); err != nil {
		return
	}

	appTitle := e.getAppTitle()
	title := fmt.Sprintf("%s: %s is %s", appTitle, m.Name, status)
	var message string
	if target := strings.TrimSpace(m.Target); target != "" {
		message = fmt.Sprintf("Service %s (%s) changed status to %s", m.Name, target, status)
	} else {
		message = fmt.Sprintf("Service %s changed status to %s", m.Name, status)
	}

	var notifications []struct {
		Type   string `db:"type"`
		Config string `db:"config"`
	}
	query := `
		SELECT n.type, n.config 
		FROM notifications n
		JOIN monitor_notifications mn ON n.id = mn.notification_id
		WHERE mn.monitor_id = ?
	`
	e.db.Select(&notifications, query, monitorID)

	for _, n := range notifications {
		extra := map[string]string{
			"link": m.Target,
			"info": fmt.Sprintf("Type: %s, Interval: %ds", m.Type, m.Interval),
		}
		// Send notification asynchronously to avoid blocking
		go func(notifType, config string) {
			if err := notification.SendNotification(notifType, config, title, message, extra); err != nil {
				log.Printf("Failed to send notification for monitor %s: %v", m.Name, err)
			}
		}(n.Type, n.Config)
	}
}
