/**
 * HTML cleaning utilities
 * Adapted from original Firecrawl's removeUnwantedElements.ts
 */

import * as cheerio from 'cheerio';

// Tags and classes to exclude when extracting main content
const excludeNonMainTags = [
  'header',
  'footer',
  'nav',
  'aside',
  '.header',
  '.top',
  '.navbar',
  '#header',
  '.footer',
  '.bottom',
  '#footer',
  '.sidebar',
  '.side',
  '.aside',
  '#sidebar',
  '.modal',
  '.popup',
  '#modal',
  '.overlay',
  '.ad',
  '.ads',
  '.advert',
  '#ad',
  '.lang-selector',
  '.language',
  '#language-selector',
  '.social',
  '.social-media',
  '.social-links',
  '#social',
  '.menu',
  '.navigation',
  '#nav',
  '.breadcrumbs',
  '#breadcrumbs',
  '.cookie',
  '#cookie',
];

export interface CleanHtmlOptions {
  url: string;
  onlyMainContent?: boolean;
}

/**
 * Clean and transform HTML
 * - Removes scripts, styles, and other unwanted elements
 * - Optionally extracts only main content
 * - Converts relative URLs to absolute
 */
export function cleanHtml(html: string, options: CleanHtmlOptions): string {
  const { url, onlyMainContent = true } = options;
  
  const $ = cheerio.load(html);

  // Extract base href if present (fixes relative URL resolution)
  const baseEl = $('base[href]');
  const baseHref = baseEl.length > 0 ? baseEl.attr('href') : null;
  const finalBaseUrl = baseHref 
    ? new URL(baseHref, url).href 
    : url;

  // Always remove these elements
  $('script, style, noscript, meta, head').remove();

  // CRITICAL: Fix code blocks before Turndown processing
  // Modern syntax highlighters (Shiki, Prism) wrap each line in <span class="line">
  // This breaks Turndown's code block detection, causing lost commas/formatting
  $('pre code').each((_, el) => {
    const codeEl = $(el);
    // Extract pure text content, preserving line breaks
    const text = codeEl.text();
    // Replace complex nested structure with simple text node
    codeEl.empty().text(text);
    
    // Extract language from class for better markdown output
    const className = codeEl.attr('class') || '';
    const langMatch = className.match(/language-(\w+)|lang-(\w+)/);
    if (langMatch) {
      const lang = langMatch[1] || langMatch[2];
      codeEl.closest('pre').attr('data-language', lang);
    }
  });

  // Remove non-main content if requested
  if (onlyMainContent) {
    excludeNonMainTags.forEach(tag => {
      $(tag).remove();
    });
  }

  // Handle lazy-loaded images (common pattern)
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    const dataSrc = $el.attr('data-src') || $el.attr('data-lazy-src') || $el.attr('data-original');
    
    // If no src but has data-src, promote it
    if (!src && dataSrc) {
      $el.attr('src', dataSrc);
    }
  });

  // Convert relative image URLs to absolute (using finalBaseUrl)
  $('img[src]').each((_, el) => {
    try {
      const src = $(el).attr('src');
      if (src) {
        $(el).attr('src', new URL(src, finalBaseUrl).href);
      }
    } catch (_) {}
  });

  // Handle srcset for images (pick largest)
  $('img[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;

    const sizes = srcset.split(',').map(x => {
      const tok = x.trim().split(' ');
      return {
        url: tok[0],
        size: parseInt((tok[1] ?? '1x').slice(0, -1), 10),
        isX: (tok[1] ?? '').endsWith('x'),
      };
    });

    const src = $(el).attr('src');
    if (sizes.every(x => x.isX) && src) {
      sizes.push({
        url: src,
        size: 1,
        isX: true,
      });
    }

    sizes.sort((a, b) => b.size - a.size);

    if (sizes[0]) {
      $(el).attr('src', sizes[0].url);
      $(el).removeAttr('srcset');
    }
  });

  // Convert relative link URLs to absolute (using finalBaseUrl)
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (href) {
        $(el).attr('href', new URL(href, finalBaseUrl).href);
      }
    } catch (_) {}
  });

  // Extract social media images if no images found
  // This helps with pages that only show preview images in meta tags
  if ($('img').length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    const images = [ogImage, twitterImage].filter(Boolean);
    
    if (images.length > 0) {
      const imgTags = images.map(src => {
        try {
          const absoluteSrc = new URL(src!, finalBaseUrl).href;
          return `<img src="${absoluteSrc}" alt="Featured image" />`;
        } catch (_) {
          return '';
        }
      }).filter(Boolean).join('\n');
      
      $('body').prepend(imgTags);
    }
  }

  return $.html();
}
