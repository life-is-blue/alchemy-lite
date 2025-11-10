/**
 * HTTP server
 * Philosophy: Simple, synchronous, direct
 */

import express, { Request, Response, NextFunction } from 'express';
import { scrape } from './scraper/index.js';
import { crawl } from './crawler/index.js';
import { ScrapeRequestSchema, CrawlRequestSchema } from './types.js';
import { logger } from './logger.js';

const app = express();

// Middleware
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Simple request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Optional API key authentication
const API_KEY = process.env.API_KEY;

function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    // No API key configured, allow all requests
    next();
    return;
  }

  const providedKey = req.headers.authorization?.replace('Bearer ', '');
  if (providedKey !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scrape endpoint
app.post('/scrape', authenticate, async (req: Request, res: Response) => {
  try {
    const request = ScrapeRequestSchema.parse(req.body);
    const result = await scrape(request);
    res.json(result);
  } catch (error) {
    logger.error('Scrape request failed', { error: error instanceof Error ? error.message : error });
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid request',
    });
  }
});

// Crawl endpoint
app.post('/crawl', authenticate, async (req: Request, res: Response) => {
  try {
    const request = CrawlRequestSchema.parse(req.body);
    const result = await crawl(request);
    res.json(result);
  } catch (error) {
    logger.error('Crawl request failed', { error: error instanceof Error ? error.message : error });
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid request',
    });
  }
});

// 404 handler (must be after all routes)
app.use((req: Request, res: Response) => {
  // Static files already handled by express.static
  // API routes already handled above
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

export function startServer(port: number = 3000): void {
  app.listen(port, () => {
    logger.info(`Firecrawl Lite server started`, { port });
    logger.info(`Web UI: http://localhost:${port}/`);
    logger.info(`API Key authentication: ${API_KEY ? 'enabled' : 'disabled'}`);
  });
}

export default app;
