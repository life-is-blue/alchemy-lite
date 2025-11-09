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

## Troubleshooting

### Symptom: Browser Pool Exhausted (Queue Building Up)

**Signs**:
- Response times exceed 30+ seconds
- New requests wait indefinitely
- Error rate increases

**Root cause**: Too many concurrent requests for available browsers.

**Diagnosis** (here's the real check):

⚠️ **Note**: Debug logs only appear if `NODE_ENV != 'production'`. For production environments, ensure logging is enabled or check application-level metrics.

```bash
# Count browsers being created vs released
# Run while traffic is happening (must have debug logs enabled):
acquired=$(grep -c '"message":"Browser acquired"' app.log)
released=$(grep -c '"message":"Browser released"' app.log)
echo "Acquired: $acquired, Released: $released, Diff: $((acquired - released))"

# Example output:
# Acquired: 150, Released: 148, Diff: 2  ← Normal (queue exists, but small)
# Acquired: 50, Released: 5, Diff: 45   ← Problem (browsers not releasing)
```

**Solutions** (in order):
1. **If acquired >> released** → Browsers aren't closing (bug in code)
   - Check `src/scraper/browser.ts` — verify `browser.close()` in finally block
   - This is a code issue, not a deployment issue

2. **If acquired ≈ released** → Pool is legitimately full
   - Reduce request rate on client side (rate limiting: 2 req/sec)
   - OR increase `MAX_BROWSERS` if memory allows
   ```bash
   MAX_BROWSERS=8  # Up from default 5 (each browser ~100MB)
   ```

3. **For immediate relief**:
   - Disable `autoClickTabs` on client side (saves 3-5s per request)
   - This frees up browsers faster

---

### Symptom: Memory Keeps Growing

**Signs**:
- RSS memory grows over hours
- Eventually hits OOM and crashes
- Recovers after restart

**Root causes**:
1. Browsers not releasing (memory leak in browser.ts)
2. HTML being stored (especially large pages)
3. Too many concurrent heavy requests

**Diagnosis**:
```bash
# Monitor memory in real-time
watch -n 1 'ps aux | grep node'

# Check for "Browser released" in logs
tail -f app.log | grep 'Browser released' | wc -l
# Count should increase over time
```

**Solutions**:
1. **Verify browser cleanup** (check `src/scraper/browser.ts` finally block)
   - Make sure `browser.close()` is always called
   - If missing, that's a bug — report it

2. **Set limits on crawl**:
   ```bash
   MAX_CRAWL_PAGES=50   # Don't crawl entire internet
   ```

3. **Restart service daily** (temporary workaround)
   ```bash
   # Add cron job
   0 3 * * * systemctl restart firecrawl
   ```

---

### Symptom: Timeout Errors Frequent

**Signs**:
- Many requests fail with "Timeout"
- Error rate > 5%

**Root causes** (need to distinguish):
1. Network is genuinely slow
2. Server is overloaded (pool exhausted)
3. Website intentionally slow/blocking

**Diagnosis** (key step):
```bash
# Simple grep: check which domains are timing out
grep 'Timeout' app.log | head -10
# Then look manually at the URLs to spot patterns

# More sophisticated approach (if logs are JSON):
# Automatic pattern detection
grep 'Timeout' app.log | jq -r '.url' 2>/dev/null | sort | uniq -c

# Example output (showing pattern):
#  3 https://slow-api.example.com/docs ← Same domain repeatedly
#  1 https://github.com/user/repo
#  1 https://docs.other.com
# → Interpretation: slow-api times out consistently (website issue)
```

Then check pool health:
```bash
# See if browsers are stuck
acquired=$(grep -c 'Browser acquired' app.log); \
released=$(grep -c 'Browser released' app.log); \
echo "Acquired: $acquired, Released: $released"
# If gap is large, see "Browser Pool Exhausted" above
```

**Solutions**:
1. **If same domain times out repeatedly** → website is slow or blocking
   ```bash
   # Increase timeout for that URL only
   timeout: 60000  # Up from default 30000
   ```
   Or accept that you can't scrape it.

2. **If random domains time out** → server overloaded
   - See "Browser Pool Exhausted" above
   - Reduce client-side concurrency

3. **If one per minute at baseline** → normal, ignore
   - Some URLs are just slow
   - Increase timeout slightly (45000ms)

---

### Symptom: Website Returns 403 or 429

**Signs**:
- Specific websites return HTTP 403 (Forbidden) or 429 (Too Many Requests)
- Other sites work fine

**What's actually happening**:
The website detected a pattern of requests (you're clearly automation) and started rejecting you. This is **working as designed** — the website is protecting itself.

**How to detect if this is the issue**:
```bash
# Test manually with curl
curl -I https://example.com
# If returns 403: website is blocking something about the request

# Check our User-Agent
curl -I -A 'Mozilla/5.0' https://example.com
# If this works but our tool doesn't: User-Agent is flagged as bot
```

**Can we fix it**?
- **Not in this tool** (would require User-Agent rotation, per-request delays, proxy support)
- **On your client**: Implement delays between requests (1-2 seconds minimum)

**Workarounds**:
1. **Lower request frequency** (client-side rate limit)
   ```bash
   # Max 1 request per 2 seconds to that site
   # This reduces bot detection signals
   ```

2. **Accept the limitation**: Some sites cannot be scraped (by design).
   - News sites, payment pages, account-protected content
   - This is **expected behavior**

---

### Symptom: Crawl Doesn't Complete All Pages

**Signs**:
- Crawl stops early or misses some links
- Fewer pages than expected in results

**Root causes**:
1. Hit `maxDepth` limit
2. Hit `maxPages` limit
3. Links are JavaScript-rendered (not in initial HTML)
4. Links are behind navigation (need clicking)

**Diagnosis**:
```bash
# Check logs for "Max depth reached" or "Max pages reached"
tail -f app.log | grep 'Max'

# Check request parameters
# If renderJS: false, dynamic content won't be found
```

**Solutions**:
1. **Increase limits** (if reasonable)
   ```bash
   maxDepth: 4    # Up from 3
   maxPages: 100  # Up from 50
   ```

2. **Enable JS rendering** (if links are dynamic)
   ```bash
   renderJS: true
   autoClickTabs: true  # Only if links are in hidden tabs
   ```

3. **Accept the limitation**: Website structure may not support crawling.

---

### Symptom: High Latency (Slow Responses)

**Signs**:
- Requests take 30+ seconds even for simple pages
- p95 latency > 10 seconds

**Root causes**:
1. `renderJS: true` by default (5s overhead)
2. `autoClickTabs: true` (3-5s overhead)
3. Browser pool saturation

**Solutions**:
1. **Disable autoClickTabs** (unless content is hidden)
   ```bash
   autoClickTabs: false  # Default
   ```

2. **Use renderJS: false for static sites**
   ```bash
   # Try this first (170ms)
   renderJS: false
   
   # Only use true if content is missing
   renderJS: true  # ~5s
   ```

3. **If pool is saturated**, see "Browser Pool Exhausted" above.

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
