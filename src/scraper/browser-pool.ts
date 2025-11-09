/**
 * Simple browser pool for managing concurrent Puppeteer instances
 * Prevents resource exhaustion and system crashes
 */

import puppeteer, { Browser } from 'puppeteer';
import { logger } from '../logger.js';

export class BrowserPool {
  private browsers: Browser[] = [];
  private activeCount = 0;
  private queue: Array<() => Promise<void>> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<Browser> {
    // Wait if at max capacity
    while (this.activeCount >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeCount++;

    const browser = await puppeteer.launch({
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

    this.browsers.push(browser);
    logger.debug('Browser acquired', { activeCount: this.activeCount, poolSize: this.browsers.length });

    return browser;
  }

  async release(browser: Browser): Promise<void> {
    this.activeCount--;
    const index = this.browsers.indexOf(browser);
    if (index > -1) {
      this.browsers.splice(index, 1);
    }
    await browser.close().catch(() => {});
    logger.debug('Browser released', { activeCount: this.activeCount, poolSize: this.browsers.length });
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.browsers.map(b => b.close().catch(() => {})));
    this.browsers = [];
    this.activeCount = 0;
    logger.info('Browser pool closed');
  }
}

// Global singleton pool
let globalPool: BrowserPool | null = null;

export function getGlobalBrowserPool(): BrowserPool {
  if (!globalPool) {
    globalPool = new BrowserPool(parseInt(process.env.MAX_BROWSERS || '5', 10));
  }
  return globalPool;
}
