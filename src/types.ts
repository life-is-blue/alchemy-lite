import { z } from 'zod';

/**
 * Scrape request schema
 */
export const ScrapeRequestSchema = z.object({
  url: z.string().url(),
  renderJS: z.boolean().optional().default(false),
  timeout: z.number().int().positive().optional().default(30000),
  autoClickTabs: z.boolean().optional().default(false),
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

/**
 * Scrape response
 */
export interface ScrapeResponse {
  success: boolean;
  url: string;
  markdown?: string;
  html?: string;
  error?: string;
}

/**
 * Crawl request schema
 */
export const CrawlRequestSchema = z.object({
  url: z.string().url(),
  maxDepth: z.number().int().positive().optional().default(3),
  maxPages: z.number().int().positive().optional().default(50),
  renderJS: z.boolean().optional().default(false),
  timeout: z.number().int().positive().optional().default(30000),
  pathPrefix: z.string().optional(),
});

export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

/**
 * Crawl response
 */
export interface CrawlResponse {
  success: boolean;
  baseUrl: string;
  pages: ScrapeResponse[];
  totalPages: number;
  error?: string;
}
