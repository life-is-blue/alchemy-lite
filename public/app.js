// DOM Elements
const form = document.getElementById('scrapeForm');
const urlInput = document.getElementById('url');
const renderJSCheckbox = document.getElementById('renderJS');
const autoClickTabsCheckbox = document.getElementById('autoClickTabs');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultDiv = document.getElementById('result');
const markdownTextarea = document.getElementById('markdown');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Global state for batch processing
let batchResults = [];
let isBatchMode = false;

// Constants
const MAX_BATCH_SIZE = 50;
const REQUEST_TIMEOUT = 30000; // 30 seconds

//=============================================================================
// Utility Functions
//=============================================================================

/**
 * Show button success feedback
 */
function showButtonSuccess(button, successIcon, successText, successLabel, duration = 2000) {
  const btnText = button.querySelector('span');
  const btnIcon = button.querySelector('use');
  const originalText = btnText.textContent;
  const originalIcon = btnIcon.getAttribute('href');
  const originalLabel = button.getAttribute('aria-label');
  
  button.classList.add('success');
  btnText.textContent = successText;
  btnIcon.setAttribute('href', `/icons.svg#${successIcon}`);
  button.setAttribute('aria-label', successLabel);
  
  setTimeout(() => {
    button.classList.remove('success');
    btnText.textContent = originalText;
    btnIcon.setAttribute('href', originalIcon);
    button.setAttribute('aria-label', originalLabel);
  }, duration);
}

/**
 * Parse URLs from textarea (with validation)
 * Only allows http:// and https:// protocols
 */
function parseURLs(input) {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (line.length === 0) return false;
      if (line.startsWith('#')) return false; // Support comments
      
      try {
        const url = new URL(line);
        // Only allow HTTP/HTTPS protocols
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (e) {
        console.warn(`Invalid URL skipped: ${line}`);
        return false;
      }
    });
}

/**
 * Create icon element (avoids XSS from innerHTML)
 */
function createIcon(iconName) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon');
  
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${iconName}`);
  
  svg.appendChild(use);
  return svg;
}

/**
 * Update progress message (XSS-safe)
 */
function updateProgress(completed, total) {
  errorDiv.textContent = ''; // Clear
  errorDiv.appendChild(createIcon('icon-spinner'));
  errorDiv.appendChild(document.createTextNode(` 正在批量抓取：${completed}/${total} 已完成`));
  errorDiv.classList.add('show', 'info');
}

/**
 * Show error message (XSS-safe)
 */
function showError(message) {
  errorDiv.textContent = ''; // Clear
  errorDiv.appendChild(createIcon('icon-warning'));
  errorDiv.appendChild(document.createTextNode(` ${message}`));
  errorDiv.classList.add('show');
  errorDiv.classList.remove('info');
}

/**
 * Show success message (XSS-safe)
 */
function showSuccess(message) {
  errorDiv.textContent = ''; // Clear
  errorDiv.appendChild(createIcon('icon-checkmark'));
  errorDiv.appendChild(document.createTextNode(` ${message}`));
  errorDiv.classList.add('show', 'info');
}

/**
 * Escape Markdown special characters
 */
function escapeMarkdown(text) {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

/**
 * Scrape a single URL (with timeout)
 */
async function scrapeURL(url, options = {}) {
  const { timeout = REQUEST_TIMEOUT } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch('/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        renderJS: renderJSCheckbox.checked,
        autoClickTabs: autoClickTabsCheckbox.checked,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Categorize errors for better user feedback
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败');
    } else {
      throw error;
    }
  }
}

/**
 * Auto-adjust textarea height based on content
 */
let resizeTimer;
urlInput.addEventListener('input', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const urls = parseURLs(urlInput.value);
    urlInput.rows = urls.length > 0 ? Math.min(Math.max(urls.length, 1), 8) : 1;
  }, 100); // Debounce 100ms
});

//=============================================================================
// Form Submission
//=============================================================================

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Clear previous results and errors
  errorDiv.classList.remove('show', 'info');
  errorDiv.textContent = '';
  resultDiv.classList.remove('show');
  batchResults = [];
  
  // Parse URLs with validation
  const urls = parseURLs(urlInput.value);
  
  if (urls.length === 0) {
    showError('请输入有效的 URL（仅支持 http:// 和 https://）');
    return;
  }
  
  isBatchMode = urls.length > 1;
  
  if (isBatchMode) {
    await handleBatchScrape(urls);
  } else {
    await handleSingleScrape(urls[0]);
  }
});

/**
 * Handle single URL scrape
 */
async function handleSingleScrape(url) {
  submitBtn.disabled = true;
  loading.style.display = 'inline-flex';
  
  try {
    const data = await scrapeURL(url);
    
    // Show result
    markdownTextarea.value = data.markdown || '';
    resultDiv.classList.add('show');
    
    // Smooth scroll to result
    setTimeout(() => {
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.disabled = false;
    loading.style.display = 'none';
  }
}

/**
 * Handle batch scrape (multiple URLs)
 */
async function handleBatchScrape(urls) {
  // Validate batch size
  if (urls.length > MAX_BATCH_SIZE) {
    showError(`批量抓取最多支持 ${MAX_BATCH_SIZE} 个 URL，当前 ${urls.length} 个`);
    return;
  }
  
  submitBtn.disabled = true;
  loading.style.display = 'inline-flex';
  
  const total = urls.length;
  let completed = 0;
  
  // Show initial progress
  updateProgress(0, total);
  
  try {
    for (const url of urls) {
      try {
        const data = await scrapeURL(url);
        
        batchResults.push({
          url: url,
          markdown: data.markdown || '',
          success: true,
        });
      } catch (error) {
        batchResults.push({
          url: url,
          error: error.message,
          success: false,
        });
      }
      
      // Update progress
      completed++;
      updateProgress(completed, total);
    }
    
    // Generate merged markdown
    const mergedMarkdown = generateMergedMarkdown(batchResults);
    markdownTextarea.value = mergedMarkdown;
    resultDiv.classList.add('show');
    
    // Show completion message
    const successCount = batchResults.filter(r => r.success).length;
    const failCount = total - successCount;
    
    showSuccess(`批量抓取完成：${successCount} 成功，${failCount} 失败`);
    
    // Smooth scroll to result
    setTimeout(() => {
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
  } catch (error) {
    showError(`批量抓取失败：${error.message}`);
  } finally {
    submitBtn.disabled = false;
    loading.style.display = 'none';
  }
}

/**
 * Generate merged markdown from batch results
 */
function generateMergedMarkdown(results) {
  const timestamp = new Date().toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  let markdown = `# Batch Scrape Results (${results.length} pages)\n`;
  markdown += `> Generated: ${timestamp}\n\n`;
  markdown += `---\n\n`;
  
  results.forEach((result, index) => {
    markdown += `## ${index + 1}. ${escapeMarkdown(result.url)}\n\n`;
    
    if (result.success) {
      markdown += result.markdown;
    } else {
      markdown += `**❌ Error:** ${escapeMarkdown(result.error)}\n`;
    }
    
    markdown += `\n\n---\n\n`;
  });
  
  return markdown;
}

//=============================================================================
// Copy & Download
//=============================================================================

/**
 * Handle copy to clipboard
 */
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(markdownTextarea.value);
    showButtonSuccess(
      copyBtn,
      'icon-checkmark',
      copyBtn.getAttribute('data-copied-text') || '已复制',
      '已复制到剪贴板'
    );
  } catch (error) {
    alert(copyBtn.getAttribute('data-error-text') || 'Failed to copy to clipboard');
  }
});

/**
 * Handle download markdown file
 */
downloadBtn.addEventListener('click', () => {
  const markdown = markdownTextarea.value;
  if (!markdown) return;

  let filename;
  
  if (isBatchMode) {
    // Batch mode: use timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    filename = `batch-results-${timestamp}.md`;
  } else {
    // Single mode: extract from URL
    filename = 'scraped-content.md';
    try {
      const url = new URL(urlInput.value.trim());
      const path = url.pathname.split('/').filter(Boolean).pop();
      if (path && path.length > 0) {
        filename = path.replace(/\.[^.]*$/, '') + '.md';
      } else {
        filename = url.hostname.replace(/[^a-zA-Z0-9]/g, '-') + '.md';
      }
    } catch (e) {
      // Use default filename
    }
  }

  // Create blob and download
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Show feedback
  showButtonSuccess(
    downloadBtn,
    'icon-checkmark',
    downloadBtn.getAttribute('data-downloaded-text') || '已下载',
    '文件已下载'
  );
  
  // Clean up memory after download
  setTimeout(() => {
    if (batchResults.length > 0) {
      batchResults = [];
    }
  }, 2000);
});
