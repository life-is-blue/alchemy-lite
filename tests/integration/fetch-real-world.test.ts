/**
 * Integration tests for real-world HTTP fetch scenarios
 * These tests require external network access and are skipped by default
 * Run with: npm run test:integration
 */

import { describe, it, expect } from 'vitest';
import { fetchAndParse } from '../../src/scraper/fetch.js';

describe('fetchAndParse - Real World Tests', () => {
  // Note: These tests depend on external network and should only be run
  // in integration test environments where network is available and stable
  
  it('should fetch from example.com', async () => {
    const result = await fetchAndParse({ 
      url: 'https://example.com',
      timeout: 10000 
    });
    
    expect(result).toBeDefined();
    expect(result.markdown).toContain('Example Domain');
  }, 15000);

  it('should handle gzip from real website', async () => {
    // Tencent Cloud docs (known to use gzip)
    const result = await fetchAndParse({ 
      url: 'https://cloud.tencent.com/document/product/1759/122982',
      timeout: 10000 
    });
    
    expect(result).toBeDefined();
    expect(result.markdown).toContain('腾讯云');
    expect(result.markdown.length).toBeGreaterThan(100);
    // Should be valid text, not binary garbage
    expect(result.markdown).toMatch(/[\u4e00-\u9fa5]/); // Contains Chinese characters
  }, 15000);
});
