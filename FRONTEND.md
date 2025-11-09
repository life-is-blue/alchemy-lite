# Frontend Integration Guide

When building a frontend app that calls Firecrawl Lite, consider these factors.

---

## 1. Error Handling

Always assume requests can fail.

```javascript
async function scrapeUrl(url) {
  try {
    const response = await fetch('http://api.example.com/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, renderJS: false })
    });

    const data = await response.json();

    if (!data.success) {
      console.error(`Failed: ${data.error}`);
      return null;
    }

    return data.markdown;
  } catch (error) {
    // Network error, service down, etc.
    console.error(`Network error: ${error.message}`);
    return null;
  }
}
```

---

## 2. Timeout Management

Don't wait forever.

```javascript
// Set a reasonable timeout (don't exceed 30s)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch('/scrape', {
    method: 'POST',
    signal: controller.signal,
    body: JSON.stringify({ url, renderJS: false })
  });
  return await response.json();
} finally {
  clearTimeout(timeoutId);
}
```

**Guidance**:
- Static pages: expect 200-500ms
- JS pages: expect 5-8 seconds
- Add 2-3 second buffer for network

---

## 3. Backoff & Retry

Transient failures are normal.

```javascript
async function scrapeWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await scrapeUrl(url);
      if (result) return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

---

## 4. Caching

Never scrape the same URL twice.

```javascript
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

async function getCachedContent(url) {
  const cacheKey = url;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await scrapeUrl(url);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

**Better**: Use Redis/Memcached for distributed cache.

---

## 5. Request Queuing

Don't hammer the API.

```javascript
class ScrapeQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
  }

  async add(url) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.process();
    });
  }

  async process() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      this.active++;
      const { url, resolve, reject } = this.queue.shift();

      try {
        const result = await scrapeUrl(url);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.active--;
        this.process();
      }
    }
  }
}

// Usage
const queue = new ScrapeQueue(5);
await Promise.all(urls.map(url => queue.add(url)));
```

---

## 6. Progress Tracking

Users want feedback during long operations.

```javascript
async function scrapeMultipleUrls(urls, onProgress) {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress({
      current: i + 1,
      total: urls.length,
      percent: ((i + 1) / urls.length * 100).toFixed(0),
      url
    });

    try {
      const markdown = await scrapeUrl(url);
      results.push({ url, markdown, success: true });
    } catch (error) {
      results.push({ url, error: error.message, success: false });
    }
  }

  return results;
}

// Usage in React
scrapeMultipleUrls(urls, (progress) => {
  console.log(`${progress.percent}% - Processing ${progress.url}`);
  setProgress(progress);
});
```

---

## 7. User Feedback

Show meaningful status to users.

```javascript
const statusMap = {
  'HTTP 403': 'Website blocked automated access',
  'HTTP 404': 'Page not found',
  'Timeout': 'Page took too long to load',
  'Network error': 'Connection failed, retry later',
  'HTTP 429': 'Too many requests, wait a moment',
};

function getUserFriendlyError(error) {
  for (const [key, message] of Object.entries(statusMap)) {
    if (error.includes(key)) {
      return message;
    }
  }
  return 'Unable to scrape this page';
}

// Show to user
catch (error) {
  alert(getUserFriendlyError(error.message));
}
```

---

## 8. Content Handling

Markdown can be large. Handle it properly.

```javascript
async function displayContent(markdown) {
  // Don't render huge documents instantly
  if (markdown.length > 1000000) {
    console.warn('Document is very large (1MB+)');
    // Option A: Truncate
    // Option B: Paginate
    // Option C: Virtual scroll
  }

  // Sanitize before rendering (XSS prevention)
  const sanitized = DOMPurify.sanitize(markdown);

  // Convert to HTML if using markdown-it
  const html = markdownIt.render(sanitized);

  document.getElementById('content').innerHTML = html;
}
```

---

## 9. JavaScript Detection

Some sites need JS rendering, some don't. Test first.

```javascript
async function smartScrape(url) {
  // Try fast method first
  let result = await scrapeUrl(url, { renderJS: false });

  if (result.markdown.length < 100) {
    // Probably missing content, try with JS
    console.log('Content too small, retrying with JS rendering...');
    result = await scrapeUrl(url, { renderJS: true });
  }

  return result;
}
```

---

## 10. Performance Optimization

Consider frontend performance too.

```javascript
// Don't parse huge documents on main thread
// Use Web Worker
const worker = new Worker('scraper-worker.js');

worker.postMessage({ urls, urls });
worker.onmessage = (event) => {
  const results = event.data;
  updateUI(results);
};
```

---

## 11. Analytics

Track what works and what doesn't.

```javascript
async function scrapeWithAnalytics(url) {
  const startTime = performance.now();
  const result = await scrapeUrl(url);
  const duration = performance.now() - startTime;

  analytics.track('scrape', {
    url,
    success: result.success,
    duration,
    contentLength: result.markdown?.length || 0,
    error: result.error
  });

  return result;
}
```

---

## 12. Rate Limiting

Respect the service.

```javascript
class RateLimiter {
  constructor(rps = 2) {
    this.rps = rps;
    this.lastRequest = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    const requiredWait = 1000 / this.rps;

    if (timeSinceLastRequest < requiredWait) {
      await new Promise(r => 
        setTimeout(r, requiredWait - timeSinceLastRequest)
      );
    }

    this.lastRequest = Date.now();
  }
}

const limiter = new RateLimiter(2); // 2 requests per second

for (const url of urls) {
  await limiter.wait();
  const result = await scrapeUrl(url);
}
```

---

## Checklist

- [ ] Error handling for all failures
- [ ] Timeout protection
- [ ] Retry logic with backoff
- [ ] Response caching
- [ ] Request queuing (max 3-5 concurrent)
- [ ] Progress feedback
- [ ] User-friendly errors
- [ ] Content size checks
- [ ] XSS prevention (sanitize)
- [ ] Performance monitoring
- [ ] Rate limiting
- [ ] Analytics tracking

---

## Example: React Component

```jsx
import { useState, useEffect } from 'react';

function ScrapeForm() {
  const [url, setUrl] = useState('');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, renderJS: false })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setContent(data.markdown);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter URL"
      />
      <button onClick={handleScrape} disabled={loading}>
        {loading ? 'Scraping...' : 'Scrape'}
      </button>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {content && <pre>{content}</pre>}
    </div>
  );
}
```

---

That's it. Build with these principles in mind.
