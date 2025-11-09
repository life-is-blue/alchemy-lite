/**
 * Lightweight HTTP-based scraper
 * This is the default engine - fast, efficient, minimal resource usage
 */

import { request } from 'undici';
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
 * Fetch and parse a URL using simple HTTP request
 */
export async function fetchAndParse(options: FetchOptions): Promise<FetchResult> {
  const { url, timeout = 30000 } = options;

  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FirecrawlLite/1.0)',
    },
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });

  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode}`);
  }

  const rawHtml = await body.text();
  const cleanedHtml = cleanHtml(rawHtml, { url, onlyMainContent: true });
  const markdown = await parseMarkdown(cleanedHtml);

  return { html: cleanedHtml, markdown };
}
