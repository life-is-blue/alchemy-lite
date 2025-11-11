//=============================================================================
// Configuration Module (引用外部AppConfig)
//=============================================================================

const Config = {
  get MAX_BATCH_SIZE() { return AppConfig.get('features.maxBatchSize', 50); },
  get REQUEST_TIMEOUT() { return AppConfig.get('features.requestTimeout', 30000); },
  get PROGRESS_DEBOUNCE() { return AppConfig.get('ui.progressDebounce', 100); },
  get BUTTON_SUCCESS_DURATION() { return AppConfig.get('ui.buttonSuccessDuration', 2000); },
};

// Timeout追踪列表（用于cleanup）
const timeoutTracker = [];

//=============================================================================
// UI Elements Manager
//=============================================================================

const UIElements = {
  form: null,
  urlInput: null,
  renderJSCheckbox: null,
  autoClickTabsCheckbox: null,
  submitBtn: null,
  loading: null,
  errorDiv: null,
  resultDiv: null,
  markdownTextarea: null,
  copyBtn: null,
  downloadBtn: null,

  init() {
    this.form = document.getElementById('scrapeForm');
    this.urlInput = document.getElementById('url');
    this.renderJSCheckbox = document.getElementById('renderJS');
    this.autoClickTabsCheckbox = document.getElementById('autoClickTabs');
    this.submitBtn = document.getElementById('submitBtn');
    this.loading = document.getElementById('loading');
    this.errorDiv = document.getElementById('error');
    this.resultDiv = document.getElementById('result');
    this.markdownTextarea = document.getElementById('markdown');
    this.copyBtn = document.getElementById('copyBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
  }
};

//=============================================================================
// Batch Processor Module (封装批处理状态和逻辑)
//=============================================================================

const BatchProcessor = {
  results: [],
  isBatchMode: false,
  resizeTimer: null,
  listeners: [],
  timeouts: [],

  /**
   * 获取batch结果
   */
  getResults() {
    return this.results;
  },

  /**
   * 设置batch模式
   */
  setBatchMode(isBatch) {
    this.isBatchMode = isBatch;
  },

  /**
   * 检查是否batch模式
   */
  getIsBatchMode() {
    return this.isBatchMode;
  },

  /**
   * 重置batch状态
   */
  reset() {
    this.results = [];
    this.isBatchMode = false;
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  },

  /**
   * 添加batch结果
   */
  addResult(url, markdown, success, error = null) {
    this.results.push({
      url,
      markdown,
      success,
      error,
    });
  },

  /**
   * 获取成功/失败计数
   */
  getStats() {
    const total = this.results.length;
    const successCount = this.results.filter(r => r.success).length;
    const failCount = total - successCount;
    return { total, successCount, failCount };
  },

  /**
   * 清理资源
   */
  destroy() {
    this.reset();
    // 清理所有pending的timeout
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeouts = [];
    // 移除所有监听器
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  },

  /**
   * 注册监听器（便于后续cleanup）
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
  },

  /**
   * 注册timeout（便于cleanup）
   */
  addTimeout(timeoutId) {
    this.timeouts.push(timeoutId);
  },

  /**
   * 移除timeout
   */
  removeTimeout(timeoutId) {
    const index = this.timeouts.indexOf(timeoutId);
    if (index > -1) {
      this.timeouts.splice(index, 1);
    }
  }
};

//=============================================================================
// Utility Functions
//=============================================================================

/**
 * 显示按钮成功反馈
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
  
  const timeoutId = setTimeout(() => {
    button.classList.remove('success');
    btnText.textContent = originalText;
    btnIcon.setAttribute('href', originalIcon);
    button.setAttribute('aria-label', originalLabel);
    // 清理此timeout
    BatchProcessor.removeTimeout(timeoutId);
  }, duration);

  // 注册timeout以便cleanup
  BatchProcessor.addTimeout(timeoutId);
  return timeoutId;
}

/**
 * 解析URL（支持验证）
 * 仅允许 http:// 和 https:// 协议
 */
function parseURLs(input) {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (line.length === 0) return false;
      if (line.startsWith('#')) return false; // 支持注释
      
      try {
        const url = new URL(line);
        // 仅允许HTTP/HTTPS协议
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (e) {
        console.warn(`Invalid URL skipped: ${line}`);
        return false;
      }
    });
}

/**
 * 创建图标元素（避免XSS）
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
 * 更新进度消息（XSS安全）
 */
function updateProgress(completed, total) {
  UIElements.errorDiv.textContent = '';
  UIElements.errorDiv.appendChild(createIcon('icon-spinner'));
  UIElements.errorDiv.appendChild(document.createTextNode(` 正在批量抓取：${completed}/${total} 已完成`));
  UIElements.errorDiv.classList.add('show', 'info');
}

/**
 * 显示错误消息（XSS安全）
 */
function showError(message) {
  UIElements.errorDiv.textContent = '';
  UIElements.errorDiv.appendChild(createIcon('icon-warning'));
  UIElements.errorDiv.appendChild(document.createTextNode(` ${message}`));
  UIElements.errorDiv.classList.add('show');
  UIElements.errorDiv.classList.remove('info');
}

/**
 * 显示成功消息（XSS安全）
 */
function showSuccess(message) {
  UIElements.errorDiv.textContent = '';
  UIElements.errorDiv.appendChild(createIcon('icon-checkmark'));
  UIElements.errorDiv.appendChild(document.createTextNode(` ${message}`));
  UIElements.errorDiv.classList.add('show', 'info');
}

/**
 * 转义Markdown特殊字符
 */
function escapeMarkdown(text) {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

/**
 * 抓取单个URL（支持超时）
 */
async function scrapeURL(url, options = {}) {
  const { timeout = Config.REQUEST_TIMEOUT } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch('/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        renderJS: UIElements.renderJSCheckbox.checked,
        autoClickTabs: UIElements.autoClickTabsCheckbox.checked,
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
    
    // 分类错误以便更好的用户反馈
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败');
    } else {
      throw error;
    }
  }
}

//=============================================================================
// Batch Processing Logic
//=============================================================================

/**
 * 生成合并的Markdown（包括失败摘要）
 */
function generateMergedMarkdown(results) {
  const timestamp = new Date().toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const stats = BatchProcessor.getStats();
  
  let markdown = `# 批量抓取结果 (${results.length} 个页面)\n`;
  markdown += `> 生成时间：${timestamp}\n`;
  markdown += `> **状态：${stats.successCount} 成功，${stats.failCount} 失败**\n\n`;
  markdown += `---\n\n`;
  
  // 成功的结果
  const successResults = results.filter(r => r.success);
  if (successResults.length > 0) {
    markdown += `## ✅ 成功抓取的内容 (${successResults.length})\n\n`;
    successResults.forEach((result, index) => {
      markdown += `### ${index + 1}. ${escapeMarkdown(result.url)}\n\n`;
      markdown += result.markdown;
      markdown += `\n\n---\n\n`;
    });
  }
  
  // 失败的结果
  const failResults = results.filter(r => !r.success);
  if (failResults.length > 0) {
    markdown += `## ❌ 失败的URL (${failResults.length})\n\n`;
    failResults.forEach((result, index) => {
      markdown += `### ${index + 1}. ${escapeMarkdown(result.url)}\n`;
      markdown += `**错误:** ${escapeMarkdown(result.error)}\n\n`;
    });
    markdown += `\n---\n\n`;
  }
  
  markdown += `## 说明\n`;
  markdown += `- 失败的URL可能由于网络故障、服务器错误或内容不可访问\n`;
  markdown += `- 请检查URL是否正确，或稍后重新尝试\n`;
  markdown += `- 如果某些失败是暂时的，可以单独重新抓取\n`;
  
  return markdown;
}

/**
 * 处理单个URL抓取
 */
async function handleSingleScrape(url) {
  UIElements.submitBtn.disabled = true;
  UIElements.loading.style.display = 'inline-flex';
  
  try {
    const data = await scrapeURL(url);
    
    // 显示结果
    UIElements.markdownTextarea.value = data.markdown || '';
    UIElements.resultDiv.classList.add('show');
    
    // 平滑滚动到结果
    const scrollTimeoutId = setTimeout(() => {
      UIElements.resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      BatchProcessor.removeTimeout(scrollTimeoutId);
    }, 100);
    BatchProcessor.addTimeout(scrollTimeoutId);
    
  } catch (error) {
    showError(error.message);
  } finally {
    UIElements.submitBtn.disabled = false;
    UIElements.loading.style.display = 'none';
  }
}

/**
 * 处理批量抓取（改进失败处理）
 */
async function handleBatchScrape(urls) {
  // 验证批量大小
  if (urls.length > Config.MAX_BATCH_SIZE) {
    showError(`批量抓取最多支持 ${Config.MAX_BATCH_SIZE} 个 URL，当前 ${urls.length} 个`);
    return;
  }
  
  UIElements.submitBtn.disabled = true;
  UIElements.loading.style.display = 'inline-flex';
  
  const total = urls.length;
  let completed = 0;
  
  // 重置batch状态
  BatchProcessor.reset();
  BatchProcessor.setBatchMode(true);
  
  // 显示初始进度
  updateProgress(0, total);
  
  try {
    // 处理所有URL，继续处理即使某个失败
    for (const url of urls) {
      try {
        const data = await scrapeURL(url);
        BatchProcessor.addResult(url, data.markdown || '', true);
      } catch (error) {
        BatchProcessor.addResult(url, '', false, error.message);
      }
      
      // 更新进度
      completed++;
      updateProgress(completed, total);
    }
    
    // 生成合并的markdown
    const mergedMarkdown = generateMergedMarkdown(BatchProcessor.getResults());
    UIElements.markdownTextarea.value = mergedMarkdown;
    UIElements.resultDiv.classList.add('show');
    
    // 显示完成消息
    const stats = BatchProcessor.getStats();
    showSuccess(`批量抓取完成：${stats.successCount} 成功，${stats.failCount} 失败`);
    
    // 平滑滚动到结果
    const scrollTimeoutId = setTimeout(() => {
      UIElements.resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      BatchProcessor.removeTimeout(scrollTimeoutId);
    }, 100);
    BatchProcessor.addTimeout(scrollTimeoutId);
    
  } catch (error) {
    showError(`批量抓取出错：${error.message}`);
  } finally {
    UIElements.submitBtn.disabled = false;
    UIElements.loading.style.display = 'none';
  }
}

//=============================================================================
// Event Handlers with Cleanup
//=============================================================================

/**
 * 处理表单提交
 */
function handleFormSubmit(e) {
  e.preventDefault();
  
  // 清理之前的结果和错误
  UIElements.errorDiv.classList.remove('show', 'info');
  UIElements.errorDiv.textContent = '';
  UIElements.resultDiv.classList.remove('show');
  
  // 解析URL
  const urls = parseURLs(UIElements.urlInput.value);
  
  if (urls.length === 0) {
    showError('请输入有效的 URL（仅支持 http:// 和 https://）');
    return;
  }
  
  if (urls.length > 1) {
    handleBatchScrape(urls);
  } else {
    handleSingleScrape(urls[0]);
  }
}

/**
 * 处理textarea自动调整高度
 */
function handleTextareaInput() {
  if (BatchProcessor.resizeTimer) {
    clearTimeout(BatchProcessor.resizeTimer);
  }
  
  BatchProcessor.resizeTimer = setTimeout(() => {
    const urls = parseURLs(UIElements.urlInput.value);
    UIElements.urlInput.rows = urls.length > 0 ? Math.min(Math.max(urls.length, 1), 8) : 1;
  }, Config.PROGRESS_DEBOUNCE);
}

/**
 * 处理复制到剪贴板
 */
async function handleCopyClick() {
  try {
    await navigator.clipboard.writeText(UIElements.markdownTextarea.value);
    const timeoutId = showButtonSuccess(
      UIElements.copyBtn,
      'icon-checkmark',
      UIElements.copyBtn.getAttribute('data-copied-text') || '已复制',
      '已复制到剪贴板'
    );
    // 记录此timeoutId以便cleanup（可选）
  } catch (error) {
    alert(UIElements.copyBtn.getAttribute('data-error-text') || 'Failed to copy to clipboard');
  }
}

/**
 * 处理下载文件
 */
function handleDownloadClick() {
  const markdown = UIElements.markdownTextarea.value;
  if (!markdown) return;

  let filename;
  
  if (BatchProcessor.getIsBatchMode()) {
    // Batch模式：使用时间戳
    const timestamp = new Date().toISOString().slice(0, 10);
    filename = `batch-results-${timestamp}.md`;
  } else {
    // 单个模式：从URL提取
    filename = 'scraped-content.md';
    try {
      const url = new URL(UIElements.urlInput.value.trim());
      const path = url.pathname.split('/').filter(Boolean).pop();
      if (path && path.length > 0) {
        filename = path.replace(/\.[^.]*$/, '') + '.md';
      } else {
        filename = url.hostname.replace(/[^a-zA-Z0-9]/g, '-') + '.md';
      }
    } catch (e) {
      // 使用默认文件名
    }
  }

  // 创建blob并下载
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // 显示反馈
  showButtonSuccess(
    UIElements.downloadBtn,
    'icon-checkmark',
    UIElements.downloadBtn.getAttribute('data-downloaded-text') || '已下载',
    '文件已下载'
  );
  
  // 延迟清理内存
  const cleanupTimeoutId = setTimeout(() => {
    BatchProcessor.reset();
    BatchProcessor.removeTimeout(cleanupTimeoutId);
  }, 2000);
  BatchProcessor.addTimeout(cleanupTimeoutId);
}

//=============================================================================
// Application Initialization
//=============================================================================

/**
 * 初始化应用
 */
function initApp() {
  // 初始化UI元素
  UIElements.init();
  
  // 注册事件监听器
  BatchProcessor.addEventListener(UIElements.form, 'submit', handleFormSubmit);
  BatchProcessor.addEventListener(UIElements.urlInput, 'input', handleTextareaInput);
  BatchProcessor.addEventListener(UIElements.copyBtn, 'click', handleCopyClick);
  BatchProcessor.addEventListener(UIElements.downloadBtn, 'click', handleDownloadClick);
  
  console.log('Firecrawl Lite initialized');
}

/**
 * 清理应用资源
 */
function destroyApp() {
  BatchProcessor.destroy();
  console.log('Firecrawl Lite cleaned up');
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initApp);

// 页面卸载时清理
window.addEventListener('beforeunload', destroyApp);
window.addEventListener('unload', destroyApp);
