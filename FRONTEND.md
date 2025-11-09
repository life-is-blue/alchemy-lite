# Frontend Integration Guide

When building a frontend that calls Firecrawl Lite, follow these principles.

---

## Core Patterns

### 1. Always Handle Errors

```javascript
async function scrapeUrl(url) {
  try {
    const response = await fetch('http://api.example.com/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, renderJS: false })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    
    return data.markdown;
  } catch (error) {
    console.error(`Scrape failed: ${error.message}`);
    return null;
  }
}
```

**Why**: Network failures, timeouts, and server errors are normal. Always assume requests can fail.

---

### 2. Timeout Protection

```javascript
async function scrapeWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/scrape', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ url, renderJS: false })
    });
    
    // Check for HTTP errors (fetch doesn't reject on 4xx/5xx)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Why**: Don't wait forever. Set reasonable limits (10-30s).

**Timing expectations**:
- Static HTML: 200-500ms
- JS rendering: 5-8 seconds
- Always add 2-3s buffer for network

---

### 3. Retry with Backoff (Smart)

```javascript
// Only retry transient errors, not permanent ones
const RETRYABLE_ERRORS = [408, 429, 500, 502, 503, 504];

function isRetryable(errorMessage) {
  // Handle various error formats
  if (errorMessage.includes('Timeout')) return true;      // Timeout = transient
  if (errorMessage.includes('ECONNREFUSED')) return true; // Connection refused = transient
  
  const match = errorMessage.match(/HTTP (\d+)/);
  if (match) {
    return RETRYABLE_ERRORS.includes(parseInt(match[1]));
  }
  
  return false; // Unknown error, don't retry
}

async function scrapeWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await scrapeUrl(url);
    } catch (error) {
      // Don't retry 403, 404, malformed responses, etc.
      if (!isRetryable(error.message)) throw error;
      
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

**Why**: Not all errors should be retried.
- **Retryable** (transient): Timeout, connection refused, 429, 5xx
- **Not retryable** (permanent): 403 (forbidden), 404 (not found), malformed JSON

Retrying permanent errors just wastes time.

---

## Best Practices

- **Cache aggressively**: Never scrape the same URL twice. Use Redis or simple Map with TTL.
- **Respect rate limits**: Add client-side throttling (1-2 requests/second).
- **Show progress**: For batch operations, report which URLs completed.
- **Smart rendering**: Try `renderJS: false` first. Only use `true` if content is missing.
- **Sanitize content**: If rendering Markdown to HTML, use DOMPurify to prevent XSS.

---

## Common Error Handling

```javascript
const errorMessages = {
  'HTTP 403': 'Website blocked automated access',
  'HTTP 404': 'Page not found',
  'Timeout': 'Page took too long to load',
  'Network error': 'Connection failed, retry later',
};

function getUserMessage(error) {
  for (const [key, msg] of Object.entries(errorMessages)) {
    if (error.includes(key)) return msg;
  }
  return 'Unable to scrape this page';
}
```

---

## Example: React Component

```jsx
import { useState } from 'react';

export function ScrapeForm() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [content, setContent] = useState(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, renderJS: false })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
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
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {content && <pre>{content}</pre>}
    </div>
  );
}
```

---

**That's it. Keep client code simple: error → retry → cache → display.**
