# Firecrawl Lite

Production-ready web scraper. 933 lines. Does one thing well.

## Quick Start

```bash
npm install && npm run build && npm start
```

## Testing

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode for development
```

**Test Structure:**
```
tests/
├── unit/                 # Unit tests
│   ├── logger.test.ts
│   ├── types.test.ts
│   └── lib/
│       └── clean-html.test.ts
└── integration/          # Integration tests (future)
```

## API

**POST /scrape** - Convert URL to Markdown
```json
{"url": "https://example.com", "renderJS": false, "autoClickTabs": false}
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

## Known Limitations

**Dynamic Tabs**: Sites using lazy-rendered tabs (React Headless UI, etc.) need `autoClickTabs: true` to capture all tabs. CSS-hidden tabs are automatically included.
