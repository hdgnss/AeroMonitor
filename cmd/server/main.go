package main

import (
	"aeromonitor/internal/auth"
	"aeromonitor/internal/db"
	"aeromonitor/internal/monitor"
	"aeromonitor/internal/settings"
	"aeromonitor/internal/setup"
	"log"
	"net/http"
	"os"

	"strings"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize Database
	database, err := db.InitDB("aeromonitor.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize Settings
	settingsService := settings.NewService(database)
	settingsHandler := settings.NewHandler(settingsService)

	// Initialize Auth
	// AuthHandler now takes SettingsService to create OIDC provider dynamically
	authHandler := auth.NewAuthHandler(settingsService)

	// Initialize Monitor Engine
	engine := monitor.NewEngine(database, settingsService)
	engine.Start()
	defer engine.Stop()

	// Initialize Echo
	e := echo.New()

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Skipper: func(c echo.Context) bool {
			// Skip logging for static assets and health checks
			path := c.Request().URL.Path
			if strings.HasPrefix(path, "/assets/") || path == "/api/health" {
				return true
			}
			// Skip logging for frequent polling (GET /api/monitors...)
			if c.Request().Method == http.MethodGet && strings.HasPrefix(path, "/api/monitors") {
				return true
			}
			return false
		},
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Initialize Setup Handler
	setupHandler := setup.NewHandler(settingsService)

	// API Routes
	api := e.Group("/api")

	// Public Setup Routes
	setupGroup := api.Group("/setup")
	setupGroup.GET("/status", setupHandler.GetStatus)
	setupGroup.POST("", setupHandler.Setup)

	// Public Auth Routes
	authGroup := api.Group("/auth")
	authGroup.POST("/login", authHandler.PasswordLogin)
	authGroup.GET("/oidc/login", authHandler.Login)
	authGroup.GET("/callback", authHandler.Callback)
	authGroup.GET("/logout", authHandler.Logout)
	authGroup.GET("/me", authHandler.GetUser)

	// Public Settings
	api.GET("/settings/public", settingsHandler.GetPublicSettings)

	// Public Health
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public Status Routes (requires Bearer Auth if configured)
	publicGroup := api.Group("/public")
	engine.RegisterStatusRoutes(publicGroup)

	// Public Push Routes (no auth needed)
	engine.RegisterPushRoutes(api)

	// Public Export Routes
	engine.RegisterExportRoutes(api)

	// Protected API Routes
	protected := api.Group("")
	protected.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			cookie, err := c.Cookie("auth_token")
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing token"})
			}

			claims, err := auth.ValidateJWT(cookie.Value)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
			}

			c.Set("user", claims)
			return next(c)
		}
	})

	// Admin-only Routes
	adminOnly := protected.Group("")
	adminOnly.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := c.Get("user").(*auth.Claims)
			if user.Role != "admin" {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Admin access required"})
			}
			return next(c)
		}
	})

	// Settings Routes (Admin only)
	adminOnly.GET("/settings", settingsHandler.GetSettings)
	adminOnly.POST("/settings", settingsHandler.UpdateSettings)

	// Register Monitor Routes
	engine.RegisterPublicMonitorRoutes(protected)
	engine.RegisterAdminMonitorRoutes(adminOnly)

	// Status Page Routes (Public)
	// These are registered on engine.RegisterMonitorRoutes but we might want them public.
	// Actually, let's register status page separately if needed, or check RegisterMonitorRoutes.

	// Serve Frontend with SPA fallback
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Root:   "ui/dist",
		Index:  "index.html",
		HTML5:  true,
		Browse: false,
	}))

	// Start Server
	port := os.Getenv("HTTP_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on :%s", port)
	if err := e.Start(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
