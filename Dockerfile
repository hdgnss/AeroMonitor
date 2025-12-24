# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/ui

# Copy package files and install dependencies
COPY ui/package*.json ./
RUN npm ci

# Copy source code and build
COPY ui/ ./
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

# Install build dependencies (required for CGO and SQLite)
RUN apk add --no-cache git ca-certificates gcc musl-dev

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server

# Stage 3: Final Runtime Image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata sqlite

# Create app user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled backend from builder
COPY --from=backend-builder /app/server /app/server

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/ui/dist /app/ui/dist

# Create directory for database with proper permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Set environment variables
ENV GIN_MODE=release
ENV DB_PATH=/app/data/aeromonitor.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run the application
CMD ["/app/server"]
