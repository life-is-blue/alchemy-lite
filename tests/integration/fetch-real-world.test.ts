/**
 * Integration tests for real-world HTTP fetch scenarios
 * These tests require external network access and are skipped by default
 * Run with: npm run test:integration
 * 
 * Core test cases are defined below and will run with two representative URLs.
 * Additional URLs can be added to tests/urls.txt for reference or parameterized testing.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndParse } from '../../src/scraper/fetch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test URLs from urls.txt for reference and optional parameterized testing
function loadTestUrls() {
  const urlsFile = path.join(__dirname, '../urls.txt');
  try {
    const content = fs.readFileSync(urlsFile, 'utf-8');
    return content
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0 && url.startsWith('http'));
  } catch (error) {
    throw new Error(
      `Failed to load test URLs from ${urlsFile}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Hard-coded core test cases that must always run
const CORE_TESTS = [
  {
    name: 'example.com',
    url: 'https://example.com',
    description: 'Simple static HTML site',
    expectations: { content: 'Example Domain' }
  },
  {
    name: 'tencent-cloud',
    url: 'https://cloud.tencent.com/document/product/1759/122982',
    description: 'Gzip-compressed response with Chinese content',
    expectations: { 
      content: '腾讯云',
      minLength: 100,
      hasChineseChars: true
    }
  }
];

describe('fetchAndParse - Real World Tests', () => {
  // Note: These tests depend on external network and should only be run
  // in integration test environments where network is available and stable
  
  CORE_TESTS.forEach(testCase => {
    it(`should fetch from ${testCase.name} (${testCase.description})`, async () => {
      const result = await fetchAndParse({ 
        url: testCase.url,
        timeout: 10000 
      });
      
      expect(result).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(result.markdown.length).toBeGreaterThan(0);
      
      // Validate expectations
      const exp = testCase.expectations;
      if (exp.content) {
        expect(result.markdown).toContain(exp.content);
      }
      if (exp.minLength) {
        expect(result.markdown.length).toBeGreaterThan(exp.minLength);
      }
      if (exp.hasChineseChars) {
        expect(result.markdown).toMatch(/[\u4e00-\u9fa5]/);
      }
    }, 15000);
  });

  // Optional: Parameterized tests for all URLs from urls.txt (needs explicit opt-in)
  // Uncomment the code below to test all URLs listed in tests/urls.txt
  /*
  const allUrls = loadTestUrls();
  
  allUrls.forEach((url, index) => {
    it(`[OPTIONAL] should fetch URL ${index + 1}: ${new URL(url).hostname}`, async () => {
      const result = await fetchAndParse({ url, timeout: 15000 });
      expect(result).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(result.markdown.length).toBeGreaterThan(0);
    }, 20000);
  });
  */
});
