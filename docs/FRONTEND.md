# Frontend Integration Guide

When building a frontend that calls Firecrawl Lite, follow these principles.

---

## Core Patterns

### 1. Always Handle Errors

```javascript
async function scrapeUrl(url) {
  try {
    // Using reverse proxy (same domain) - see DEPLOYMENT.md
    const response = await fetch('/api/scrape', {
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

**For cross-domain deployments** (not recommended):
```javascript
const API_BASE = 'https://api.example.com';
const response = await fetch(`${API_BASE}/api/scrape`, {
  // ... rest of request
});
```

**Why**: Network failures, timeouts, and server errors are normal. Always assume requests can fail.

---

### 2. Timeout Protection

```javascript
async function scrapeWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api/scrape', {
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

### 4. Crawl with Real-time Progress (SSE)

For large crawls, use Server-Sent Events to show real-time progress:

```javascript
async function crawlWithProgress(url, maxPages, onProgress) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 min
  
  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream', // Trigger SSE mode
      },
      body: JSON.stringify({ url, maxPages, renderJS: false }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB limit
    let buffer = '';
    let finalResult = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Prevent memory leak
      if (buffer.length > MAX_BUFFER_SIZE) {
        reader.cancel();
        throw new Error('Response too large');
      }
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const event = JSON.parse(line.substring(6));
          
          if (event.type === 'progress') {
            // Validate data (prevent NaN/Infinity)
            const completed = Math.max(0, Number(event.completed) || 0);
            const total = Math.max(1, Number(event.total) || 1);
            onProgress(completed, total, event.currentUrl);
          } else if (event.type === 'result') {
            finalResult = event.data;
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Crawl failed');
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', line, parseError);
        }
      }
    }
    
    if (!finalResult) throw new Error('No result received');
    return finalResult;
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Usage
await crawlWithProgress(
  'https://docs.example.com',
  50,
  (completed, total, url) => {
    console.log(`Progress: ${completed}/${total} - ${url}`);
    document.getElementById('progress').textContent = 
      `Crawling: ${completed}/${total}`;
  }
);
```

**Critical SSE safeguards**:
- ✅ **10-min timeout with AbortController** - prevents hanging forever
- ✅ **10MB buffer limit** - prevents memory exhaustion attacks
- ✅ **Data validation** - `Math.max()` prevents NaN/division by zero
- ✅ **Cleanup in finally** - always clear timeout even on error

**Why not EventSource**?
- `EventSource` doesn't support POST requests or custom headers
- Need full control over request body and timeout handling
- `ReadableStream` API is more flexible for our use case

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
