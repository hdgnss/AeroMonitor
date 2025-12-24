package monitor

import (
	"time"
)

type MonitorType string

const (
	TypeHTTP       MonitorType = "http"
	TypeTCP        MonitorType = "tcp"
	TypePing       MonitorType = "ping"
	TypePush       MonitorType = "push"
	TypeFileUpdate MonitorType = "file_update"
)

type Monitor struct {
	ID                   string      `db:"id" json:"id"`
	OwnerID              string      `db:"owner_id" json:"owner_id"`
	Name                 string      `db:"name" json:"name"`
	Type                 MonitorType `db:"type" json:"type"`
	Target               string      `db:"target" json:"target"`
	Interval             int         `db:"interval" json:"interval"` // in seconds
	NotificationChannels string      `db:"notification_channels" json:"notification_channels"`
	Metadata             string      `db:"metadata" json:"metadata"`
	Group                string      `db:"monitor_group" json:"monitor_group"`
	Paused               bool        `db:"paused" json:"paused"`
}

type Heartbeat struct {
	ID        int64     `db:"id" json:"id"`
	MonitorID string    `db:"monitor_id" json:"monitor_id"`
	Status    string    `db:"status" json:"status"`   // "up", "down"
	Latency   int       `db:"latency" json:"latency"` // in ms
	Message   string    `db:"message" json:"message"`
	Data      string    `db:"data" json:"data"` // JSON custom data
	Timestamp time.Time `db:"timestamp" json:"timestamp"`
}

type Result struct {
	MonitorID string
	Status    string
	Latency   int
	Message   string
	Data      string
}
