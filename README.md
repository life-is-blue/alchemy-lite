# Firecrawl Lite

Production-ready web scraper. 933 lines. Does one thing well.

## Philosophy

Inspired by Unix philosophy and Linus Torvalds' principles:
- **Do one thing well**: Convert URLs to clean text
- **Minimal dependencies**: Only essential packages
- **Synchronous, predictable behavior**: No hidden concurrency surprises
- **Explicit performance trade-offs**: Browser rendering takes 5s, HTTP takes 170ms—you choose

## Architecture at a Glance

**Dual-engine design**:
- **Lightweight**: Direct HTTP fetch + Cheerio HTML parsing (~170ms per page)
- **Heavyweight**: Puppeteer browser rendering for JS-heavy sites (~5s avg)

**Core components**:
```
scraper/
├── fetch.ts         # Lightweight engine: undici HTTP + cheerio
├── browser.ts       # Heavyweight engine: Puppeteer
└── browser-pool.ts  # Concurrency control (default: 5 browsers)

crawler/
└── index.ts         # Recursive DFS crawler with domain filtering
```

**Key design decisions**:
- Recursive synchronous crawling (simplicity over throughput)
- Browser pooling prevents resource exhaustion
- Resource blocking enabled by default (faster rendering)
- Tab clicking disabled by default (adds 3-5s, only for dynamic React tabs)
- URL deduplication removes `#` and `?` before storage
- Domain filtering: crawler respects domain boundaries

## Quick Start

**Development (with Caddy reverse proxy):**

```bash
# Terminal 1: Start backend
npm install
npm run dev

# Terminal 2: Start frontend
cd public && python3 -m http.server 8080

# Terminal 3: Start reverse proxy
caddy run --config config/Caddyfile
```

Visit http://localhost:8000

**Don't want Caddy?** Access frontend directly at http://localhost:8080, set in browser console:
```javascript
window.API_BASE = 'http://localhost:3000/api';
```

**Detailed deployment guide**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Testing

```bash
npm test                 # Run unit tests (fast)
npm run test:integration # Run integration tests (slow, real network requests)
npm run test:all         # Run all tests
npm run test:watch       # Watch mode for development
```

**Test Structure:**
```
tests/
├── unit/                        # Unit tests (fast, no external deps)
│   ├── logger.test.ts
│   ├── types.test.ts
│   └── lib/
│       └── clean-html.test.ts
└── integration/                 # Integration tests (slow, network deps, CI/CD)
    └── fetch-real-world.test.ts
```

**Git Hooks:**
- `pre-commit`: Runs unit tests (must pass) + code review check
- `pre-push`: Reminder to run integration tests in CI/CD

## API

> **Note**: API endpoints are prefixed with `/api`. See [DEPLOYMENT.md](DEPLOYMENT.md) for how this works with frontend separation.

**POST /api/scrape** - Convert URL to Markdown
```json
{"url": "https://example.com", "renderJS": false, "autoClickTabs": false}
```

**POST /api/crawl** - Recursive crawl with limits
```json
{"url": "https://example.com", "maxDepth": 2, "maxPages": 10, "pathPrefix": "/docs/"}
```
- `pathPrefix` (optional): Only crawl URLs matching this path prefix

**GET /api/health** - Health check

## Production Features

- ✅ Structured JSON logging for monitoring
- ✅ Browser pool with configurable concurrency (default: 5)
- ✅ Automatic resource blocking (images, stylesheets)
- ✅ Tab clicking for dynamic sites
- ✅ Docker multi-stage build
- ✅ Optional API key authentication

## Configuration

```bash
PORT=3000                 # Server port
MAX_BROWSERS=5           # Concurrent browser instances
MAX_CRAWL_DEPTH=3        # Crawl depth limit
MAX_CRAWL_PAGES=50       # Total pages limit
API_KEY=                 # Optional auth (leave empty to disable)
```

## Performance Notes

**Tab Clicking** (`autoClickTabs`): Disabled by default
- Only helps with dynamically-rendered tabs (Headless UI, React components)
- CSS-hidden tabs (like Moonshot API docs) don't benefit
- Adds 3-5 seconds per request with minimal content gain
- Set `autoClickTabs: true` if testing reveals hidden content

**Browser Rendering** (`renderJS`):
- Static HTML: ~170ms (recommended for most sites)
- JavaScript sites: ~5s avg (use only when needed)
- Test first: most content is available without JS rendering

See **FRONTEND.md** for integration patterns and client-side best practices.

## Troubleshooting (Quick Reference)

| Problem | Quick Fix |
|---------|-----------|
| Responses slow | Use `renderJS: false` (170ms vs 5s) |
| Memory growing | Restart daily, reduce `MAX_BROWSERS` |
| Queue building up | Increase `MAX_BROWSERS`, or reduce request rate |
| Website blocks us | Not our bug. Website anti-bot protection. |
| Missing content | Try `renderJS: true` then `autoClickTabs: true` |

See **DEPLOYMENT.md** for deployment guide and detailed troubleshooting.

## Known Limitations

**Dynamic Tabs**: Sites using lazy-rendered tabs (React Headless UI, etc.) need `autoClickTabs: true` to capture all tabs. CSS-hidden tabs are automatically included.

## Development Tricks

### Basic Crawling

Use the `/crawl` endpoint to build local knowledge bases:

```bash
# Example: Crawl entire site
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com", "maxDepth": 3, "maxPages": 200}' \
  > docs.json

# Example: Crawl specific path only (e.g., /zh/build/ directory)
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com/zh/build/", "pathPrefix": "/zh/build/", "maxPages": 50}' \
  > build-docs.json

# Search with jq
cat docs.json | jq -r '.pages[].markdown' | grep -i "keyword"
```

### Advanced: Two-Phase Hybrid Crawl

**Problem**: SPA documentation sites (VuePress, VitePress, Docusaurus) have navigation links rendered by JavaScript. Static crawling misses pages in dynamic sidebars.

**Solution**: Two-phase strategy - render once to get the link map, then crawl fast.

```bash
# Phase 1: Extract complete link map (1 page × 5s, JS rendered)
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com/guide/", "renderJS": true}' \
  | jq -r '.html' \
  | grep -oP 'href="(/guide/[^"]+\.html)"' \
  | sort -u > links.txt

# Phase 2: Batch crawl all discovered links (N pages × 170ms, static)
while IFS= read -r link; do
  curl -s -X POST http://localhost:3000/api/scrape \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://docs.example.com$link\"}"
done < links.txt | jq -s '.' > full-docs.json

# Result: 10x faster than full renderJS crawl, 100% coverage
```

**Performance comparison** (example: 20-page documentation):
- Full static crawl: `1.5s` (fast but incomplete, ~50% coverage)
- Full dynamic crawl: `100s` (complete but slow)
- **Hybrid approach: `7.5s`** (5s + 20×170ms, complete and practical)

**When to use**:
- ✅ VuePress/VitePress/Docusaurus sites
- ✅ Sites with collapsible navigation menus
- ✅ When you need 100% coverage without waiting minutes
- ❌ Static HTML sites (no benefit, use regular crawl)
