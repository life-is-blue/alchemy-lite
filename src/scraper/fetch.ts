/**
 * Lightweight HTTP-based scraper
 * This is the default engine - fast, efficient, minimal resource usage
 * 
 * Uses Node.js built-in fetch (v18+) which automatically handles:
 * - Gzip, deflate, and brotli decompression
 * - Character encoding (reads from Content-Type header charset parameter)
 * - Standard HTTP error handling
 */

import { logger } from '../logger.js';
import { cleanHtml } from '../lib/clean-html.js';
import { parseMarkdown } from '../lib/html-to-markdown.js';

export interface FetchOptions {
  url: string;
  timeout?: number;
}

export interface FetchResult {
  html: string;
  markdown: string;
}

/**
 * Fetch and parse a URL using Node.js built-in fetch
 * 
 * Automatically handles:
 * - HTTP compression (gzip, deflate, brotli)
 * - Character encoding (UTF-8 and server-declared charsets via Content-Type header)
 * - Redirects (follows by default)
 * - Timeouts via AbortController
 */
export async function fetchAndParse(options: FetchOptions): Promise<FetchResult> {
  const { url, timeout = 30000 } = options;

  // Setup timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    logger.debug(`Fetching ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FirecrawlLite/1.0)',
      },
      signal: controller.signal,
    });

    logger.debug(`Received ${response.status} from ${url}, content-type: ${response.headers.get('content-type')}`);

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    // Built-in fetch automatically:
    // 1. Decompresses gzip/deflate/brotli responses
    // 2. Decodes text using charset from Content-Type header (defaults to UTF-8)
    const rawHtml = await response.text();
    
    // Clean and convert to Markdown
    const cleanedHtml = cleanHtml(rawHtml, { url, onlyMainContent: true });
    const markdown = await parseMarkdown(cleanedHtml);

    return { html: cleanedHtml, markdown };
  } catch (error) {
    // Log and improve error messages
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        const message = `Request timeout for ${url} (${timeout}ms)`;
        logger.error(message);
        throw new Error(message);
      }
      // Add URL context to all errors
      const message = `Failed to fetch ${url}: ${error.message}`;
      logger.error(message);
      throw new Error(message);
    }
    const message = `Unknown error fetching ${url}`;
    logger.error(message);
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}
