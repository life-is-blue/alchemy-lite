/**
 * Main scraper module
 * Orchestrates between lightweight and heavyweight engines
 */

import { fetchAndParse } from './fetch.js';
import { fetchAndParseWithBrowser } from './browser.js';
import { logger } from '../logger.js';
import type { ScrapeRequest, ScrapeResponse } from '../types.js';

/**
 * Scrape a single URL
 */
export async function scrape(request: ScrapeRequest): Promise<ScrapeResponse> {
  const { url, renderJS, timeout, autoClickTabs } = request;

  try {
    const result = renderJS 
      ? await fetchAndParseWithBrowser({ url, timeout, autoClickTabs })
      : await fetchAndParse({ url, timeout });

    return {
      success: true,
      url,
      markdown: result.markdown,
      html: result.html,
    };
  } catch (error) {
    logger.error('Scrape failed', { url, error: error instanceof Error ? error.message : error });
    
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
