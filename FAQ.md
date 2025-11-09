# Firecrawl Lite - FAQ (Linus Edition)

**Keep it simple. No feature creep.**

---

## Performance

**Q: Why is Moonshot taking 8 seconds?**

A: Because it's a React app with lazy-loaded tabs. Timeline:
- Browser startup: 500ms (cached)
- Page load: 2500ms (site is slow)
- JS render: 1000ms
- Click tabs: 3000ms (5 tabs × 500ms each)
- Extract HTML: 500ms
= **8000ms total**

This is correct. Trade-off: 8s for complete content vs. incomplete in 2s.

If you need faster, don't scrape SPAs. Use their API instead.

---

**Q: Why is GitHub taking 5 seconds?**

A: Same reason. It's also a SPA. Static HTML is 170ms. Dynamic content costs time.

---

**Q: Can we make it faster?**

A: Yes, but with trade-offs:
- Remove tab clicking: -3 seconds, but miss hidden tabs
- Reduce timeout: -time, but miss some content
- Use raw APIs: Fastest, but defeats the purpose of scraping

Use the tool correctly: `renderJS: false` for static content, `renderJS: true` for dynamic.

---

## Output

**Q: Should we add YAML frontmatter?**

A: No.

Why:
- Adds parser complexity
- Client already knows the URL
- Different tools expect different metadata
- Violates single responsibility

If you need metadata:
```json
{
  "markdown": "# Content\n...",
  "metadata": {
    "url": "https://...",
    "title": "...",
    "scraped_at": "2025-11-09"
  }
}
```

Clean markdown + JSON metadata. Best of both worlds.

---

**Q: Can we include images in markdown?**

A: No. Already answered this.

Return URLs, let client decide:
- Save images? Use client's tool
- Embed base64? Client's choice
- Upload to S3? Client's infrastructure

We return markdown. You decide what to do with URLs.

---

**Q: Can we return Markdown + HTML?**

A: Yes. API returns both:
```json
{
  "success": true,
  "markdown": "...",
  "html": "..."
}
```

Use markdown for readability, HTML for fidelity.

---

## Features

**Q: What are we missing?**

A: Nothing. We're complete.

| Feature | Do we need it? | Why? |
|---------|---|---|
| Rate limiting | No | Client handles this |
| Caching | No | Simple tool, client caches |
| Retries | No | Client should implement |
| Proxy support | No | Too much scope |
| Authentication | No | Stateless server |
| Image download | No | Client's responsibility |
| Database storage | No | Client's infrastructure |
| YAML metadata | No | JSON is cleaner |
| PDF support | No | URLs only |
| Video extraction | No | URLs only |
| ... | No | Stop. We do one thing. |

**Linus view**: Resist feature creep. Do one thing well.

---

## Deployment

**Q: Do we need Docker?**

A: No. But it's nice to have.

Choose:
- Single server? Direct Node.js
- Multiple servers? Docker
- Kubernetes? Docker required
- Cloud platform? Docker helps
- Local dev? Skip it

We include Dockerfile. Use it or don't.

---

**Q: How much memory do we need?**

A: Depends on concurrency.

- 3 browsers: 256MB
- 5 browsers: 512MB (recommended)
- 8 browsers: 1GB

Rule: 100MB per browser + OS overhead.

---

**Q: What's the throughput?**

A: With `MAX_BROWSERS=5`:

- Static HTML: ~6 pages/second (170ms each)
- Dynamic SPA: ~0.2 pages/second (5s each)
- Mixed workload: ~1 page/second (average)

Better than you'd get if you tried to parallelize (crashes at OOM).

---

**Q: Should we add message queues (Redis/RabbitMQ)?**

A: No. Not our responsibility.

If you need queuing:
1. Use our API
2. Add your own queue (client side)
3. Feed URLs to our API
4. Collect results

Simple. Composable. Unix way.

---

## Logging

**Q: Where are the logs?**

A: Stdout, JSON format.

```json
{
  "timestamp": "2025-11-09T21:45:30Z",
  "level": "INFO",
  "message": "Scrape completed",
  "duration": 5000,
  "url": "https://...",
  "success": true
}
```

Pipe to:
- File: `npm start > app.log 2>&1`
- Elasticsearch: `npm start | logstash`
- Datadog: Cloud agent
- Splunk: Collector

Your choice. We just emit clean JSON.

---

## Errors

**Q: What if the website blocks us?**

A: We return error.

```json
{
  "success": false,
  "error": "HTTP 403 - Forbidden"
}
```

Handle it:
- Retry with delay
- Use different IP
- Check robots.txt
- Use their API instead

Not our problem. We tried.

---

**Q: What if the page is broken?**

A: We return partial content.

Markdown conversion is very robust. Even broken HTML usually works.

If HTML is completely broken, you get empty markdown. Log the error and move on.

---

## Development

**Q: Can we add TypeScript strict mode?**

A: Already enabled. See `tsconfig.json`:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true
}
```

---

**Q: Can we add ESLint?**

A: No. Unnecessary for a 933-line project.

Write clean code. Code review catches issues.

---

**Q: Can we add more tests?**

A: We have enough.

- Unit tests: 4 (pool, quality, network, E2E)
- Real website tests: 5
- All pass: 100%

More tests = more maintenance = less shipping.

---

**Q: What's the next version?**

A: There is no v1.1.

This is done. If you need more, fork it.

Maintain, don't expand.

---

## Still have questions?

Read: `README.md` → `INTEGRATION_GUIDE.md` → `src/`

That's it.
