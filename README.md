# AeroMonitor

A lightweight, self-hosted monitoring tool inspired by Uptime Kuma, built with Go and React.

## Getting Started

### Prerequisites
- [Go](https://golang.org/dl/) (1.21+)
- [Node.js](https://nodejs.org/) (for frontend development)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

### Running with Docker (Recommended)

**Quick Start with docker-compose:**

1. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env and set your JWT_SECRET and credentials
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **Access the Dashboard**:
   Open [http://localhost:8080](http://localhost:8080) in your browser.

**Using Docker directly:**

```bash
# Build the image
docker build -t aeromonitor:latest .

# Run the container
docker run -d \
  -p 8080:8080 \
  -v aeromonitor-data:/app/data \
  -e JWT_SECRET=your-secret-key \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  --name aeromonitor \
  aeromonitor:latest
```

### Running Locally (Development)

1. **Build the Frontend**:
   (Already built in `ui/dist`)
   ```bash
   cd ui
   npm install
   npm run build
   cd ..
   ```

2. **Run the Server**:
   ```bash
   go run cmd/server/main.go
   ```

3. **Access the Dashboard**:
   Open [http://localhost:8080](http://localhost:8080) in your browser.

## Configuration

### Environment Variables

- `HTTP_PORT` - Server HTTP port (default: 8080)
- `JWT_SECRET` - Secret key for JWT token signing (required)
- `ADMIN_USERNAME` - Admin username (default: admin)
- `ADMIN_PASSWORD` - Admin password (default: admin)
- `DB_PATH` - Database file path (default: ./aeromonitor.db)
- `OIDC_ENABLED` - Enable OIDC authentication (default: false)
- `OIDC_PROVIDER_URL` - OIDC provider URL
- `OIDC_CLIENT_ID` - OIDC client ID
- `OIDC_CLIENT_SECRET` - OIDC client secret
- `OIDC_REDIRECT_URL` - OIDC redirect URL

See `.env.example` for a complete configuration template.

## Features
- **HTTP/TCP/Ping Monitoring**: Track service availability and latency.
- **File Update Monitoring**: Monitor file changes and freshness.
- **Flexible Push API**: Send custom data points and visualize them instantly.
- **Monitor Pause/Resume**: Temporarily disable monitoring for maintenance.
- **Premium UI**: Dark-themed, responsive, and reactive dashboard.
- **Notifications**: Bark and Microsoft Teams support.
- **Authentication**: JWT-based auth with optional OIDC integration.
- **Public Status Pages**: Share monitor status publicly.
- **Lightweight**: Minimal resource footprint.

## API Usage (Push Monitoring)
Send data to your push monitors using simple GET or POST requests:
`GET http://localhost:8080/api/push/{id}?status=up&msg=OK&cpu=25&mem=60`

