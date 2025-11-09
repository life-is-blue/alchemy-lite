/**
 * Type validation tests
 * Philosophy: Validate schema behavior, especially edge cases
 */

import { describe, it, expect } from 'vitest';
import { ScrapeRequestSchema, CrawlRequestSchema } from '../../src/types.js';

describe('ScrapeRequestSchema', () => {
  it('should validate valid scrape request', () => {
    const valid = {
      url: 'https://example.com',
      renderJS: false,
      timeout: 5000,
      autoClickTabs: true,
    };
    
    const result = ScrapeRequestSchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it('should apply default values', () => {
    const minimal = { url: 'https://example.com' };
    
    const result = ScrapeRequestSchema.parse(minimal);
    
    expect(result.renderJS).toBe(false);
    expect(result.timeout).toBe(30000);
    expect(result.autoClickTabs).toBe(false); // Default should be false
  });

  it('should reject invalid URL', () => {
    const invalid = { url: 'not-a-url' };
    
    expect(() => ScrapeRequestSchema.parse(invalid)).toThrow();
  });

  it('should reject negative timeout', () => {
    const invalid = {
      url: 'https://example.com',
      timeout: -1000,
    };
    
    expect(() => ScrapeRequestSchema.parse(invalid)).toThrow();
  });

  it('should reject non-integer timeout', () => {
    const invalid = {
      url: 'https://example.com',
      timeout: 5.5,
    };
    
    expect(() => ScrapeRequestSchema.parse(invalid)).toThrow();
  });
});

describe('CrawlRequestSchema', () => {
  it('should validate valid crawl request', () => {
    const valid = {
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 10,
      renderJS: true,
      timeout: 15000,
    };
    
    const result = CrawlRequestSchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it('should apply default values', () => {
    const minimal = { url: 'https://example.com' };
    
    const result = CrawlRequestSchema.parse(minimal);
    
    expect(result.maxDepth).toBe(3);
    expect(result.maxPages).toBe(50);
    expect(result.renderJS).toBe(false);
    expect(result.timeout).toBe(30000);
  });

  it('should reject invalid maxDepth', () => {
    const invalid = {
      url: 'https://example.com',
      maxDepth: 0,
    };
    
    expect(() => CrawlRequestSchema.parse(invalid)).toThrow();
  });

  it('should reject invalid maxPages', () => {
    const invalid = {
      url: 'https://example.com',
      maxPages: -5,
    };
    
    expect(() => CrawlRequestSchema.parse(invalid)).toThrow();
  });
});
