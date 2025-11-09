/**
 * Simple, synchronous web crawler
 * Philosophy: Keep it simple, recursive, depth-first
 */

import { URL } from 'url';
import * as cheerio from 'cheerio';
import { scrape } from '../scraper/index.js';
import { logger } from '../logger.js';
import type { CrawlRequest, CrawlResponse, ScrapeResponse } from '../types.js';

/**
 * Extract all links from HTML that belong to the same domain
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links = new Set<string>();

  $('a[href]').each((_, element) => {
    try {
      const href = $(element).attr('href');
      if (!href) return;

      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl);

      // Only include links from the same domain
      if (absoluteUrl.hostname === base.hostname) {
        // Remove hash and query params for deduplication
        absoluteUrl.hash = '';
        absoluteUrl.search = '';
        links.add(absoluteUrl.toString());
      }
    } catch (error) {
      // Invalid URL, skip
    }
  });

  return Array.from(links);
}

/**
 * Crawl a website recursively
 */
export async function crawl(request: CrawlRequest): Promise<CrawlResponse> {
  const { url, maxDepth, maxPages, renderJS, timeout } = request;

  logger.info('Starting crawl', { url, maxDepth, maxPages });

  const visited = new Set<string>();
  const results: ScrapeResponse[] = [];

  /**
   * Recursive crawl function
   */
  async function crawlRecursive(currentUrl: string, depth: number): Promise<void> {
    // Check limits
    if (depth > maxDepth!) {
      logger.debug('Max depth reached', { currentUrl, depth });
      return;
    }

    if (visited.size >= maxPages!) {
      logger.debug('Max pages reached', { currentUrl, total: visited.size });
      return;
    }

    // Skip if already visited
    if (visited.has(currentUrl)) {
      return;
    }

    // Mark as visited
    visited.add(currentUrl);

    // Scrape the page
    const result = await scrape({ url: currentUrl, renderJS, timeout, autoClickTabs: true });
    results.push(result);

    logger.debug('Crawled page', { url: currentUrl, depth, total: visited.size });

    // If scrape failed, don't continue from this page
    if (!result.success || !result.html) {
      return;
    }

    // Extract links and crawl them
    const links = extractLinks(result.html, currentUrl);

    for (const link of links) {
      if (visited.size >= maxPages!) {
        break;
      }
      await crawlRecursive(link, depth + 1);
    }
  }

  try {
    await crawlRecursive(url, 1);

    logger.info('Crawl completed', { url, totalPages: results.length });

    return {
      success: true,
      baseUrl: url,
      pages: results,
      totalPages: results.length,
    };
  } catch (error) {
    logger.error('Crawl failed', { url, error: error instanceof Error ? error.message : error });

    return {
      success: false,
      baseUrl: url,
      pages: results,
      totalPages: results.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
