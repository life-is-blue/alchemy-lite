/**
 * HTML cleaning tests
 * Philosophy: Test critical transformations, not every edge case
 */

import { describe, it, expect } from 'vitest';
import { cleanHtml } from '../../../src/lib/clean-html.js';

describe('cleanHtml', () => {
  it('should remove script and style tags', () => {
    const html = `
      <html>
        <head><script>alert('xss')</script></head>
        <body>
          <style>.test { color: red; }</style>
          <p>Content</p>
        </body>
      </html>
    `;
    
    const result = cleanHtml(html, { url: 'https://example.com' });
    
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<style>');
    expect(result).toContain('Content');
  });

  it('should convert relative image URLs to absolute', () => {
    const html = '<img src="/logo.png" />';
    
    const result = cleanHtml(html, { url: 'https://example.com/page' });
    
    expect(result).toContain('https://example.com/logo.png');
  });

  it('should convert relative link URLs to absolute', () => {
    const html = '<a href="/about">About</a>';
    
    const result = cleanHtml(html, { url: 'https://example.com/page' });
    
    expect(result).toContain('https://example.com/about');
  });

  it('should handle data-src for lazy-loaded images', () => {
    const html = '<img data-src="https://example.com/image.jpg" />';
    
    const result = cleanHtml(html, { url: 'https://example.com' });
    
    expect(result).toContain('src="https://example.com/image.jpg"');
  });

  it('should preserve code block content', () => {
    const html = `
      <pre><code class="language-js">
        const x = 1;
        const y = 2;
      </code></pre>
    `;
    
    const result = cleanHtml(html, { url: 'https://example.com' });
    
    expect(result).toContain('const x = 1');
    expect(result).toContain('const y = 2');
  });

  it('should remove navigation and footer when onlyMainContent is true', () => {
    const html = `
      <header>Header</header>
      <nav>Navigation</nav>
      <main>Main content</main>
      <footer>Footer</footer>
    `;
    
    const result = cleanHtml(html, { url: 'https://example.com', onlyMainContent: true });
    
    expect(result).not.toContain('Header');
    expect(result).not.toContain('Navigation');
    expect(result).not.toContain('Footer');
    expect(result).toContain('Main content');
  });

  it('should keep all content when onlyMainContent is false', () => {
    const html = `
      <header>Header</header>
      <nav>Navigation</nav>
      <main>Main content</main>
      <footer>Footer</footer>
    `;
    
    const result = cleanHtml(html, { url: 'https://example.com', onlyMainContent: false });
    
    expect(result).toContain('Header');
    expect(result).toContain('Navigation');
    expect(result).toContain('Main content');
    expect(result).toContain('Footer');
  });

  it('should handle base href for URL resolution', () => {
    const html = `
      <html>
        <head><base href="https://cdn.example.com/"></head>
        <body><img src="logo.png" /></body>
      </html>
    `;
    
    const result = cleanHtml(html, { url: 'https://example.com' });
    
    expect(result).toContain('https://cdn.example.com/logo.png');
  });
});
