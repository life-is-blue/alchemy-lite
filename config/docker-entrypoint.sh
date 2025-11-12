#!/bin/sh
# Firecrawl Lite - Docker Entrypoint Script
# Manages dual-process architecture: Node.js backend + Caddy reverse proxy
# with proper signal handling for graceful shutdown

set -e

BACKEND_PID=""
CADDY_PID=""

# Cleanup handler - ensures both processes are stopped gracefully
cleanup() {
    echo "==> Received shutdown signal, stopping processes..."
    
    # Stop Caddy first (external-facing service)
    if [ -n "$CADDY_PID" ] && kill -0 "$CADDY_PID" 2>/dev/null; then
        echo "==> Stopping Caddy (PID: $CADDY_PID)..."
        kill -TERM "$CADDY_PID" 2>/dev/null || true
        wait "$CADDY_PID" 2>/dev/null || true
    fi
    
    # Then stop backend
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "==> Stopping backend (PID: $BACKEND_PID)..."
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    
    echo "==> Graceful shutdown complete"
    exit 0
}

# Trap SIGTERM and SIGINT for graceful shutdown
trap cleanup TERM INT

echo "==> Starting Firecrawl Lite"
echo "==> Backend: Node.js on localhost:3000"
echo "==> Proxy: Caddy on ports 80 (HTTP) and 443 (HTTPS)"

# Start Node.js backend in background
echo "==> Starting backend..."
node /app/dist/index.js &
BACKEND_PID=$!
echo "==> Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready (max 10 seconds)
echo "==> Waiting for backend to be ready..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "==> Backend is ready"
    break
  fi
  
  # Check if backend process is still running
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "==> ERROR: Backend process died during startup"
    exit 1
  fi
  
  sleep 1
done

# Final backend health check
if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "==> ERROR: Backend failed to start within 10 seconds"
  echo "==> Check logs: docker logs <container>"
  exit 1
fi

# Start Caddy in background
echo "==> Starting Caddy reverse proxy..."
echo "==> Caddy will automatically obtain SSL certificates from Let's Encrypt"
echo "==> First deployment may take 10-15 seconds for certificate provisioning"
caddy run --config /etc/caddy/Caddyfile &
CADDY_PID=$!
echo "==> Caddy started (PID: $CADDY_PID)"

# Wait for both processes - trap will handle signals
# Using specific PIDs ensures signal handling works correctly
wait $BACKEND_PID $CADDY_PID
