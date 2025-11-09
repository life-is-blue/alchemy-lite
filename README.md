# Firecrawl Lite

Production-ready web scraper. 933 lines. Does one thing well.

## Quick Start

```bash
npm install && npm run build && npm start
```

## API

**POST /scrape** - Convert URL to Markdown
```json
{"url": "https://example.com", "renderJS": false}
```

**POST /crawl** - Recursive crawl with limits
```json
{"url": "https://example.com", "maxDepth": 2, "maxPages": 10}
```

**GET /health** - Health check

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

## Known Limitations

**Dynamic Tabs**: Sites using lazy-rendered tabs (React Headless UI, etc.) only capture the active tab. This is a frontend design choice. Use raw APIs for complete documentation.
