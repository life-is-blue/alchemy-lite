# Firecrawl Lite - Integration Guide

**For third-party integrations. Keep it simple.**

## 1. Quick Integration

### Node.js / JavaScript
```bash
npm install firecrawl-lite
```

```javascript
import { scrape } from 'firecrawl-lite';

const result = await scrape({
  url: 'https://example.com',
  renderJS: false  // Use Puppeteer only if needed
});

console.log(result.markdown);
```

### Python
```bash
pip install firecrawl-lite
```

```python
from firecrawl_lite import scrape

result = scrape(url='https://example.com', render_js=False)
print(result['markdown'])
```

### cURL
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## 2. API Reference

### POST /scrape
**Single URL conversion to Markdown**

Request:
```json
{
  "url": "https://example.com",
  "renderJS": false,
  "timeout": 30000,
  "autoClickTabs": false
}
```

Response:
```json
{
  "success": true,
  "url": "https://example.com",
  "markdown": "# Page Title\n\nContent here...",
  "html": "<html>...</html>"
}
```

**Parameters:**
- `url` (required): URL to scrape
- `renderJS` (boolean): Use Puppeteer for JS rendering. Default: `false`
- `timeout` (number): Timeout in ms. Default: `30000`
- `autoClickTabs` (boolean): Click dynamic tabs. Only needed for Headless UI components. Default: `false`

**Response times:**
- Static HTML: ~170ms
- JS rendered: ~5000ms (includes browser startup)
- With tab clicking: +3-5 seconds (only if needed)

---

### POST /crawl
**Recursive crawl with limits**

Request:
```json
{
  "url": "https://example.com",
  "maxDepth": 2,
  "maxPages": 10,
  "renderJS": false
}
```

Response:
```json
{
  "success": true,
  "pages": [
    {"url": "...", "markdown": "...", "title": "..."},
    {"url": "...", "markdown": "...", "title": "..."}
  ],
  "count": 2
}
```

**Parameters:**
- `url` (required): Starting URL
- `maxDepth` (number): Crawl depth. Default: `2`
- `maxPages` (number): Max pages to crawl. Default: `50`
- `renderJS` (boolean): Use Puppeteer. Default: `false`

---

### GET /health
**Health check**

Response:
```json
{"status": "ok", "timestamp": "2025-11-09T..."}
```

---

## 3. Common Integration Patterns

### Pattern 1: Static Documentation Sites
```javascript
// Fast, no browser needed
const result = await scrape({
  url: 'https://docs.example.com',
  renderJS: false  // ✅ Use HTTP engine
});
```
**Expected time: ~200ms**

### Pattern 2: React/Vue Documentation
```javascript
// Needs browser rendering
const result = await scrape({
  url: 'https://docs.example.com',
  renderJS: true,  // ✅ Use Puppeteer
  autoClickTabs: true
});
```
**Expected time: ~5-10s**

### Pattern 3: GitHub Content
```javascript
// Works with both engines
const result = await scrape({
  url: 'https://github.com/user/repo',
  renderJS: true  // Better for discussion threads
});
```
**Expected time: ~5-8s**

### Pattern 4: Batch Processing
```javascript
// Process multiple URLs sequentially
const urls = ['url1', 'url2', 'url3'];
for (const url of urls) {
  const result = await scrape({ url });
  // Process result...
  // Browser pool handles concurrency automatically
}
```

---

## 4. Production Configuration

### Minimal Setup
```bash
PORT=3000
MAX_BROWSERS=3
NODE_ENV=production
```

### Recommended Setup
```bash
PORT=3000
MAX_BROWSERS=5              # Standard
MAX_CRAWL_DEPTH=2
MAX_CRAWL_PAGES=50
NODE_ENV=production
```

### High-Load Setup
```bash
PORT=3000
MAX_BROWSERS=8              # More browsers
MAX_CRAWL_DEPTH=2
MAX_CRAWL_PAGES=100
NODE_ENV=production
```

### With Authentication
```bash
PORT=3000
MAX_BROWSERS=5
API_KEY=your-secret-key     # Requires Bearer token
NODE_ENV=production
```

---

## 5. Error Handling

### Successful Response
```json
{
  "success": true,
  "url": "...",
  "markdown": "..."
}
```

### Error Response
```json
{
  "success": false,
  "url": "...",
  "error": "HTTP 403 - Forbidden"
}
```

**Common errors:**
- `HTTP 403`: Website blocked automated access
- `HTTP 404`: URL not found
- `Timeout`: Page took too long to load
- `Network error`: Connection failed

**Best practice**: Always check `success` field
```javascript
const result = await scrape({ url });
if (!result.success) {
  console.error(`Failed: ${result.error}`);
  // Handle error
}
```

---

## 6. Monitoring & Logs

All requests output JSON logs:
```json
{
  "timestamp": "2025-11-09T21:45:30.123Z",
  "level": "INFO",
  "message": "Scrape completed",
  "url": "https://example.com",
  "duration": 3200,
  "renderJS": false,
  "success": true,
  "contentLength": 15000
}
```

**Integrate with**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- CloudWatch
- Splunk
- Any JSON log collector

---

## 7. Performance Tips

### Tip 1: Disable JS when possible
```javascript
// ✅ Fast: ~200ms
await scrape({ url, renderJS: false });

// ❌ Slow: ~5000ms
await scrape({ url, renderJS: true });
```

### Tip 2: Use browser pool efficiently
The pool automatically manages 5 concurrent browsers.
- Sequential calls: Still benefited by pool caching
- Parallel calls: Up to 5 simultaneously
- Beyond 5: Automatically queued (FIFO)

### Tip 3: Set appropriate timeouts
```javascript
// Short timeout for fast sites
await scrape({ url, timeout: 10000 });

// Longer timeout for slow sites
await scrape({ url, timeout: 60000 });
```

### Tip 4: Only use autoClickTabs if hidden content is missing
```javascript
// Default: faster (no tab clicking)
await scrape({
  url,
  renderJS: true,
  autoClickTabs: false  // 3.2 seconds
});

// If content is incomplete, try this:
await scrape({
  url,
  renderJS: true,
  autoClickTabs: true   // +3-5 seconds, only for Headless UI
});
```

**When to use `autoClickTabs: true`:**
- React Headless UI components
- Vue dynamic tabs that delete DOM on deactivation
- Sites where content is truly hidden (not CSS-hidden)

**When NOT to use:**
- CSS-hidden tabs (all content is in DOM)
- API documentation sites (like Moonshot)
- Most traditional websites

---

## 8. Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV PORT=3000
ENV MAX_BROWSERS=5
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Run:**
```bash
docker build -t firecrawl-lite .
docker run -p 3000:3000 -e MAX_BROWSERS=5 firecrawl-lite
```

---

## 9. What This Tool Does (and doesn't)

### ✅ Does
- Convert URLs to clean Markdown
- Handle JavaScript-rendered content
- Click tabs to capture hidden content
- Provide structured JSON logs
- Manage browser concurrency safely
- Block unnecessary resources (images, stylesheets)

### ❌ Doesn't
- Download images (use URLs directly)
- Save files to disk (return Markdown/HTML)
- Bypass authentication
- Store data in databases (client responsibility)
- Extract from PDFs (URL only)

**Philosophy**: Does one thing well. Keep integration logic in client code.

---

## 10. FAQ

**Q: Should I use renderJS=true by default?**  
A: No. Start with `false`, only use `true` if content is missing.

**Q: Can I deploy without Puppeteer?**  
A: No, Puppeteer is required. But you can avoid using it by setting `renderJS: false`.

**Q: What's the browser pool for?**  
A: Prevents OOM crashes. Limits concurrent browsers to 5 (configurable).

**Q: Can I save downloaded content to database?**  
A: Yes, but that's your responsibility. This tool returns Markdown/HTML.

**Q: Should I add image downloading?**  
A: No. Keep it simple. Return URLs, let clients decide.

---

## Questions About This Tool?

**See**: `src/server.ts` (API endpoints), `src/scraper/` (core logic)

**That's it. Go integrate.**
