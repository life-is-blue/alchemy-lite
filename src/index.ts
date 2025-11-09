/**
 * Firecrawl Lite - A lightweight, efficient web scraper
 * 
 * Philosophy:
 * - Do one thing well: convert URLs to clean text
 * - Minimal dependencies
 * - Synchronous, predictable behavior
 * - Explicit performance trade-offs
 * 
 * Author: Inspired by Unix philosophy and Linus Torvalds' principles
 */

import 'dotenv/config';
import { startServer } from './server.js';
import { logger } from './logger.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// Start the server
startServer(PORT);
