/**
 * Browser-based scraper for JS-heavy websites
 * Philosophy: Use sparingly, clean up aggressively
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../logger.js';
import { cleanHtml } from '../lib/clean-html.js';
import { parseMarkdown } from '../lib/html-to-markdown.js';

export interface BrowserOptions {
  url: string;
  timeout?: number;
  autoClickTabs?: boolean;
}

export interface BrowserResult {
  html: string;
  markdown: string;
}

/**
 * Click all hidden tabs to load dynamic content
 * Handles common tab patterns in documentation sites
 */
async function clickAllTabs(page: Page): Promise<void> {
  const tabSelectors = [
    '.tab:not(.active)',
    '[role="tab"][aria-selected="false"]',
    '.tabs__item:not(.is-active)',
    'button[data-tab]:not(.active)',
    '.ant-tabs-tab:not(.ant-tabs-tab-active)',
  ];

  for (const selector of tabSelectors) {
    try {
      const tabs = await page.$$(selector);
      for (const tab of tabs) {
        await tab.click().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (_) {
      // Selector not found, continue
    }
  }
}

/**
 * Fetch and parse a URL using headless browser
 * WARNING: This is resource-intensive. Use only when necessary.
 */
export async function fetchAndParseWithBrowser(options: BrowserOptions): Promise<BrowserResult> {
  const { url, timeout = 30000, autoClickTabs = true } = options;

  logger.debug('Fetching URL with headless browser', { url });

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser with minimal resources
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
      ],
    });

    page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    const blockTypes = new Set(['image', 'stylesheet', 'font', 'media']);
    page.on('request', req => 
      blockTypes.has(req.resourceType()) ? req.abort() : req.continue()
    );

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    });

    // Wait a bit for any remaining JS to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Auto-click tabs to load hidden content
    if (autoClickTabs) {
      await clickAllTabs(page);
    }

    // Extract rendered HTML
    const rawHtml = await page.content();
    
    // Clean HTML and convert relative URLs to absolute
    const cleanedHtml = cleanHtml(rawHtml, { url, onlyMainContent: true });
    
    // Convert to markdown
    const markdown = await parseMarkdown(cleanedHtml);

    return { html: cleanedHtml, markdown };
  } finally {
    await page?.close();
    await browser?.close();
  }
}
