# Firecrawl Lite

Lightweight web scraper. 864 lines. Does one thing well.

```bash
npm install && npm run build && npm start
```

## API

**POST /scrape**
```json
{"url": "https://example.com", "renderJS": false}
```

**POST /crawl**
```json
{"url": "https://example.com", "maxDepth": 2, "maxPages": 10}
```

## Known Limitations

**Dynamic Tabs**: Sites using lazy-rendered tabs (React Headless UI, etc.) may only capture the active tab. This is a frontend design choice—inactive tabs are not in the DOM. For complete documentation, use the website's raw API docs or export feature.
