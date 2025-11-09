/**
 * HTML to Markdown converter
 * Reused from the original Firecrawl project with simplifications
 */

import TurndownService from 'turndown';
// @ts-ignore - No types available for this package
import turndownPluginGfm from 'joplin-turndown-plugin-gfm';
import { logger } from '../logger.js';

// Initialize Turndown service with GFM support
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  preformattedCode: true, // Preserve code formatting
});

// Custom rule for code blocks to preserve language hints
turndownService.addRule('fencedCodeBlock', {
  filter: function (node) {
    return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
  },
  replacement: function (content, node) {
    // Try to extract language from pre's data-language attribute (set in clean-html)
    const lang = node.getAttribute('data-language') || '';
    
    // Get the text content directly to preserve formatting
    const code = node.firstChild;
    const codeText = code.textContent || '';
    
    return '\n\n```' + lang + '\n' + codeText + '\n```\n\n';
  },
});

// Custom rule for handling links better
turndownService.addRule('inlineLink', {
  filter: function (node, options) {
    return (
      options.linkStyle === 'inlined' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    );
  },
  replacement: function (content, node) {
    const href = (node.getAttribute('href') || '').trim();
    const title = node.title ? ' "' + node.title + '"' : '';
    return '[' + content.trim() + '](' + href + title + ')\n';
  },
});

// Custom rule: Fix tab labels that stick together (e.g., "pythoncurlnode.js")
// Many doc sites use inline buttons/spans for tabs, which Turndown concatenates
turndownService.addRule('tabSeparator', {
  filter: function (node) {
    const role = node.getAttribute('role');
    const className = node.className || '';
    return role === 'tab' || 
           className.includes('tab') || 
           (node.nodeName === 'BUTTON' && node.parentNode?.className?.includes('tab'));
  },
  replacement: function (content) {
    // Add separator so "python" "curl" don't become "pythoncurl"
    return content.trim() + ' ';
  },
});

// Custom rule for nested lists to preserve indentation
turndownService.addRule('nestedList', {
  filter: function (node) {
    return (node.nodeName === 'UL' || node.nodeName === 'OL') && 
           node.parentNode && 
           node.parentNode.nodeName === 'LI';
  },
  replacement: function (content) {
    // Add proper indentation for nested lists
    return '\n' + content.split('\n').map(line => 
      line.trim() ? '  ' + line : line
    ).join('\n');
  },
});

// Add GitHub Flavored Markdown support (tables, strikethrough, task lists, etc.)
turndownService.use(turndownPluginGfm.gfm);

/**
 * Convert HTML to Markdown with proper formatting
 */
export async function parseMarkdown(
  html: string | null | undefined,
): Promise<string> {
  if (!html) {
    return '';
  }

  try {
    let markdownContent = turndownService.turndown(html);
    markdownContent = processMultiLineLinks(markdownContent);
    markdownContent = removeSkipToContentLinks(markdownContent);
    return markdownContent;
  } catch (error) {
    logger.error('Error converting HTML to Markdown', { error });
    return '';
  }
}

/**
 * Fix multi-line content inside links
 * This handles cases where link content spans multiple lines
 */
function processMultiLineLinks(markdownContent: string): string {
  let insideLinkContent = false;
  let newMarkdownContent = '';
  let linkOpenCount = 0;

  for (let i = 0; i < markdownContent.length; i++) {
    const char = markdownContent[i];

    if (char === '[') {
      linkOpenCount++;
    } else if (char === ']') {
      linkOpenCount = Math.max(0, linkOpenCount - 1);
    }
    insideLinkContent = linkOpenCount > 0;

    if (insideLinkContent && char === '\n') {
      newMarkdownContent += '\\' + '\n';
    } else {
      newMarkdownContent += char;
    }
  }
  return newMarkdownContent;
}

/**
 * Remove common "Skip to Content" navigation links
 */
function removeSkipToContentLinks(markdownContent: string): string {
  return markdownContent.replace(
    /\[Skip to Content\]\(#[^\)]*\)/gi,
    '',
  );
}
