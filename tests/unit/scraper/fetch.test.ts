/**
 * Unit tests for HTTP fetch scraper
 * Tests core functionality: decompression, encoding, error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fetchAndParse } from '../../../src/scraper/fetch.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { gzipSync } from 'zlib';

// Test server setup
let testServer: ReturnType<typeof createServer>;
let testServerUrl: string;

beforeAll(async () => {
  testServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = req.url || '/';

    // Route: /ok - normal HTML
    if (path === '/ok') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>Test Page</h1><p>Hello World</p></body></html>');
    }
    
    // Route: /gzip - gzip compressed HTML
    else if (path === '/gzip') {
      const html = '<html><body><h1>Compressed</h1><p>This is gzip compressed</p></body></html>';
      const compressed = gzipSync(Buffer.from(html));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Encoding': 'gzip',
      });
      res.end(compressed);
    }
    
    // Route: /404 - not found
    else if (path === '/404') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
    
    // Route: /500 - server error
    else if (path === '/500') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
    
    // Route: /timeout - simulate slow response
    else if (path === '/timeout') {
      // Never respond (will cause timeout)
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Too late</body></html>');
      }, 10000);
    }
    
    // Route: /empty - empty response
    else if (path === '/empty') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('');
    }
    
    // Route: /latin1 - different charset
    else if (path === '/latin1') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=iso-8859-1' });
      res.end('<html><body><h1>Latin-1</h1></body></html>');
    }
    
    // Default: 404
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const addr = testServer.address();
      if (addr && typeof addr === 'object') {
        testServerUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      }
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    testServer.close(() => resolve());
  });
});

describe('fetchAndParse - Basic Functionality', () => {
  it('should fetch uncompressed HTML content', async () => {
    const result = await fetchAndParse({ url: `${testServerUrl}/ok` });
    
    expect(result).toBeDefined();
    expect(result.html).toContain('Test Page');
    expect(result.html).toContain('Hello World');
    expect(result.markdown).toContain('# Test Page');
    expect(result.markdown).toContain('Hello World');
  });

  it('should handle gzip compressed content', async () => {
    const result = await fetchAndParse({ url: `${testServerUrl}/gzip` });
    
    expect(result).toBeDefined();
    expect(result.html).toContain('Compressed');
    expect(result.html).toContain('This is gzip compressed');
    expect(result.markdown).toContain('# Compressed');
  });

  it('should handle empty response body', async () => {
    const result = await fetchAndParse({ url: `${testServerUrl}/empty` });
    
    expect(result).toBeDefined();
    // cleanHtml might add wrapper tags, but markdown should be essentially empty
    expect(result.markdown.trim()).toBe('');
  });

  it('should handle different charset declaration', async () => {
    // Test that fetch respects Content-Type charset
    const result = await fetchAndParse({ url: `${testServerUrl}/latin1` });
    
    expect(result).toBeDefined();
    expect(result.markdown).toContain('Latin-1');
  });
});

describe('fetchAndParse - Error Handling', () => {
  it('should handle HTTP 404 errors', async () => {
    await expect(
      fetchAndParse({ url: `${testServerUrl}/404` })
    ).rejects.toThrow(/HTTP 404 for/);
  });

  it('should handle HTTP 500 errors', async () => {
    await expect(
      fetchAndParse({ url: `${testServerUrl}/500` })
    ).rejects.toThrow(/HTTP 500 for/);
  });

  it('should timeout after specified duration', async () => {
    await expect(
      fetchAndParse({ url: `${testServerUrl}/timeout`, timeout: 1000 })
    ).rejects.toThrow(/timeout.*1000ms/i);
  }, 2000); // Test timeout = request timeout + reasonable buffer


  it('should handle invalid URLs', async () => {
    await expect(
      fetchAndParse({ url: 'not-a-valid-url' })
    ).rejects.toThrow();
  });

  it('should handle network errors', async () => {
    await expect(
      fetchAndParse({ url: 'http://localhost:9999/nonexistent' })
    ).rejects.toThrow();
  });
});
