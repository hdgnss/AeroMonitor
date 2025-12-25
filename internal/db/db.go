package db

import (
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

var Schema = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    email TEXT,
    role TEXT, -- admin, user
    provider TEXT -- local, oidc
);

CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    name TEXT,
    type TEXT, -- http, tcp, ping, push
    target TEXT,
    interval INTEGER, -- default 20s
    notification_channels TEXT, -- JSON array
    metadata TEXT, -- JSON for specific config
    monitor_group TEXT,
    paused BOOLEAN DEFAULT FALSE,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id TEXT,
    status TEXT, -- up, down
    latency INTEGER,
    message TEXT,
    data TEXT, -- JSON for custom push data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(monitor_id) REFERENCES monitors(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT, -- slack, bark, email
    config TEXT -- JSON encoded settings
);

CREATE TABLE IF NOT EXISTS monitor_notifications (
    monitor_id TEXT,
    notification_id TEXT,
    PRIMARY KEY(monitor_id, notification_id),
    FOREIGN KEY(monitor_id) REFERENCES monitors(id),
    FOREIGN KEY(notification_id) REFERENCES notifications(id)
);

CREATE TABLE IF NOT EXISTS status_pages (
    id TEXT PRIMARY KEY,
    name TEXT,
    slug TEXT UNIQUE,
    monitors TEXT, -- JSON array of monitor IDs
    is_public BOOLEAN DEFAULT TRUE,
    password_hash TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
`

func InitDB(path string) (*sqlx.DB, error) {
	db, err := sqlx.Connect("sqlite3", path+"?_loc=UTC")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(Schema)
	if err != nil {
		return nil, err
	}

	// Migrations
	// Attempt to add monitor_group column if it doesn't exist
	// SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we ignore the error
	_, _ = db.Exec("ALTER TABLE monitors ADD COLUMN monitor_group TEXT")

	// Ensure no NULLs in monitor_group to avoid scan errors
	_, _ = db.Exec("UPDATE monitors SET monitor_group = '' WHERE monitor_group IS NULL")

	return db, nil
}
