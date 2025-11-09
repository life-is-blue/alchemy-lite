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

# Install Chromium for Puppeteer (if browser mode is needed)
# Comment out these lines if you only use fast mode
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
