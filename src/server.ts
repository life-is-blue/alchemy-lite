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

// Root endpoint - API information
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Firecrawl Lite API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      scrape: '/api/scrape',
      crawl: '/api/crawl',
    },
    docs: 'https://github.com/user/firecrawl-lite',
  });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scrape endpoint
app.post('/api/scrape', authenticate, async (req: Request, res: Response) => {
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

// Crawl endpoint (with SSE support)
app.post('/api/crawl', authenticate, async (req: Request, res: Response) => {
  try {
    const request = CrawlRequestSchema.parse(req.body);
    const acceptsSSE = req.headers.accept?.includes('text/event-stream');

    if (acceptsSSE) {
      // SSE mode: stream progress events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const result = await crawl(request, (event) => {
          // 检查连接是否还活着
          if (res.writableEnded || res.destroyed) {
            return; // 客户端已断开，停止写入
          }
          
          try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          } catch (writeError) {
            logger.error('SSE write failed', { error: writeError instanceof Error ? writeError.message : writeError });
          }
        });

        // Send final result
        if (!res.writableEnded && !res.destroyed) {
          res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
          res.end();
        }
      } catch (crawlError) {
        logger.error('Crawl error in SSE mode', { error: crawlError instanceof Error ? crawlError.message : crawlError });
        
        if (!res.writableEnded && !res.destroyed) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: crawlError instanceof Error ? crawlError.message : 'Crawl failed' 
          })}\n\n`);
          res.end();
        }
      }
    } else {
      // JSON mode: traditional response
      const result = await crawl(request);
      res.json(result);
    }
  } catch (error) {
    logger.error('Crawl request failed', { error: error instanceof Error ? error.message : error });
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid request',
    });
  }
});

// Catch-all 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

export function startServer(port: number = 3000): void {
  app.listen(port, () => {
    logger.info(`Firecrawl Lite API server started`, { port });
    logger.info(`API Endpoints: /api/health, /api/scrape, /api/crawl`);
    logger.info(`Note: Frontend should be deployed separately (see DEPLOYMENT.md)`);
    logger.info(`API Key authentication: ${API_KEY ? 'enabled' : 'disabled'}`);
  });
}

export default app;
