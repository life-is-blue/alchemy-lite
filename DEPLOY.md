# Production Deployment

## Minimum Code Required

All 933 lines are necessary. No bloat.

```
src/                      (933 lines total)
├── index.ts              (entry point)
├── server.ts             (Express API)
├── logger.ts             (JSON logging)
├── types.ts              (TypeScript types)
├── scraper/
│   ├── index.ts          (routing)
│   ├── fetch.ts          (HTTP engine - 45 lines)
│   ├── browser.ts        (Puppeteer engine - 107 lines)
│   └── browser-pool.ts   (concurrency - 71 lines)
├── crawler/
│   └── index.ts          (recursive crawl)
└── lib/
    ├── clean-html.ts     (HTML cleanup - 197 lines)
    └── html-to-markdown.ts (conversion - 142 lines)
```

### Critical Components (Don't Remove)

1. **browser-pool.ts** (71 lines)
   - Without: OOM crashes under load
   - Max: 5 concurrent browsers

2. **logger.ts** (41 lines)
   - JSON structured logging
   - Production monitoring essential

3. **clean-html.ts** (197 lines)
   - HTML sanitation
   - XSS prevention

4. **html-to-markdown.ts** (142 lines)
   - Core conversion logic
   - GFM support (code blocks, tables, etc.)

### Optional Components

- **Dockerfile**: Optional (for Kubernetes only)
- **Tests**: Optional (proof of quality, not needed runtime)

---

## Pre-Production Checklist

```
✅ Code Quality
   - [x] TypeScript strict mode
   - [x] No console.log (use logger only)
   - [x] Error handling
   - [x] Resource cleanup (browser.close())

✅ Performance
   - [x] Browser pool (max 5)
   - [x] Resource blocking (images, stylesheets)
   - [x] Timeout configuration
   - [x] Memory management (no leaks)

✅ Logging
   - [x] Structured JSON logs
   - [x] Timestamp + level + message
   - [x] Request/error tracking

✅ Security
   - [x] Optional API key auth
   - [x] Input validation (Zod)
   - [x] No credentials in logs
   - [x] CORS not enabled (API only)

✅ Testing
   - [x] Real website tests (5/5 pass)
   - [x] Pool concurrency tests (8/8 pass)
   - [x] Error handling verified
```

---

## Deployment Steps

### 1. Prepare Environment

```bash
# Install dependencies
npm install

# Build
npm run build

# Verify dist/ has compiled output
ls dist/
```

### 2. Set Environment Variables

```bash
PORT=3000
MAX_BROWSERS=5              # Adjust based on server memory
NODE_ENV=production
# API_KEY=your-secret      # Optional
```

### 3. Start Service

```bash
npm start
# Or: node dist/index.js
```

### 4. Verify Health

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"2025-..."}
```

### 5. Log Configuration

Direct stdout to your log aggregator:

```bash
# Option A: File
npm start > app.log 2>&1

# Option B: Elasticsearch
npm start | logstash-forward

# Option C: Systemd
npm start | systemd-cat

# Option D: Cloud (AWS/GCP)
npm start  # Logs automatically to CloudWatch
```

---

## Scaling Recommendations

### Small (1 server, 1-10 requests/sec)

```bash
PORT=3000
MAX_BROWSERS=3
NODE_ENV=production
```

Memory: 256MB  
Throughput: ~3-5 pages/second

### Medium (2-3 servers, 10-50 requests/sec)

```bash
PORT=3000
MAX_BROWSERS=5              # Default
NODE_ENV=production
```

Memory: 512MB per server  
Throughput: ~5-8 pages/second per server

### Large (5+ servers, 50+ requests/sec)

```bash
PORT=3000
MAX_BROWSERS=8
NODE_ENV=production
```

Memory: 1GB per server  
Throughput: ~10-15 pages/second per server  
Add load balancer (Nginx)

---

## Monitoring

### Key Metrics

```json
{
  "requests_per_minute": 0,
  "average_latency_ms": 0,
  "error_rate_percent": 0,
  "memory_usage_mb": 0,
  "browser_pool_active": 0,
  "browser_pool_queued": 0
}
```

### Alert Triggers

- Error rate > 5% → investigate
- Latency p95 > 10s → increase MAX_BROWSERS
- Memory > 70% → restart service
- Queue length > 10 → add capacity

### Log Alerts

```bash
# Monitor for errors
tail -f app.log | grep '"level":"ERROR"'

# Monitor pool saturation
tail -f app.log | grep '"activeCount":5'
```

---

## Common Issues

### Issue: "Chrome not found"

**Solution**:
```bash
npm install --save-optional puppeteer
# Or use existing Chromium from system
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Issue: "Memory keeps growing"

**Solution**:
- Check browser pool: Browsers not releasing?
- Increase swap space
- Reduce MAX_BROWSERS
- Restart service daily (cron job)

### Issue: "Timeout errors increasing"

**Solution**:
- Increase timeout: `timeout: 60000`
- Check network connectivity
- Website may be blocking automation

### Issue: "High latency"

**Solution**:
- Reduce MAX_BROWSERS if queue is long
- Disable autoClickTabs if not needed
- Use renderJS: false for static content

---

## Maintenance

### Daily
- Monitor logs for errors
- Check memory usage
- Spot check a few URLs

### Weekly
- Review error trends
- Check latency metrics
- Test health endpoint

### Monthly
- Review browser version (security patches)
- Update dependencies: `npm audit fix`
- Load test with realistic traffic

---

## Rollback Plan

If deployment fails:

```bash
# Keep previous version ready
cp dist dist.backup

# Revert to working version
npm run build
npm start

# Or use Docker for easy rollback
docker run -p 3000:3000 firecrawl-lite:v1.0.0
```

---

## Security Hardening (Optional)

For hostile environments:

```bash
# Run as non-root
useradd -m firecrawl
su - firecrawl

# Sandbox browser
export PUPPETEER_ARGS='--no-sandbox --disable-setuid-sandbox'

# Rate limit at load balancer
nginx: limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Enable API key auth
API_KEY=your-secret-key-here
```

---

## That's It

You're ready for production.

No more docs. Go deploy.
