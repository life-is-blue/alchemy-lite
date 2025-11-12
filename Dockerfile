# Firecrawl Lite - Minimal Docker Image
# Philosophy: Small, secure, single-purpose

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
# 如需 .npmrc 等文件，请一并 COPY
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Trim devDependencies to production only
RUN npm prune --production

# Stage 2: Runtime
FROM node:20-alpine

# Install runtime dependencies:
# - Chromium for Puppeteer (browser mode)
# - Caddy for reverse proxy + static file serving
# - tini for proper signal handling (PID 1)
# - curl for health checks
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    caddy \
    tini \
    curl \
    libcap

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application, frontend files, and configs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# Copy Caddy config and entrypoint script
COPY --chown=nodejs:nodejs config/Caddyfile.prod /etc/caddy/Caddyfile
COPY --chown=nodejs:nodejs config/docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Grant Caddy permission to bind to privileged ports (80, 443) as non-root user
# This uses Linux capabilities instead of running as root
USER root
RUN setcap CAP_NET_BIND_SERVICE=+eip /usr/sbin/caddy
USER nodejs

# Expose HTTP (80) and HTTPS (443) for Caddy
EXPOSE 80 443

CMD ["tini", "--", "/app/docker-entrypoint.sh"]
