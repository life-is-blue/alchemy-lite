# Firecrawl Lite

Lightweight web scraper. 837 lines. Does one thing well.

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
