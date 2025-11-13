//=============================================================================
// Preview Mode State
//=============================================================================

const PreviewState = {
  currentPageIndex: 0,
  pages: [],
  purifiedVersions: new Map(),
  initialized: false,
  gestureListeners: [],
  
  reset() {
    this.currentPageIndex = 0;
    this.pages = [];
    this.purifiedVersions.clear();
    unbindGestureEvents();
  }
};

//=============================================================================
// Toast State (管理timeout避免堆积)
//=============================================================================

const ToastState = {
  mainTimeout: null,      // 主界面Toast timeout
  previewTimeout: null,   // 预览模式Toast timeout
  
  clearMain() {
    if (this.mainTimeout) {
      clearTimeout(this.mainTimeout);
      this.mainTimeout = null;
    }
  },
  
  clearPreview() {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }
};

//=============================================================================
// Configuration Module (引用外部AppConfig)
//=============================================================================

const Config = {
  get MAX_BATCH_SIZE() { return AppConfig.get('features.maxBatchSize', 50); },
  get REQUEST_TIMEOUT() { return AppConfig.get('features.requestTimeout', 30000); },
  get PROGRESS_DEBOUNCE() { return AppConfig.get('ui.progressDebounce', 100); },
  get BUTTON_SUCCESS_DURATION() { return AppConfig.get('ui.buttonSuccessDuration', 2000); },
  get API_BASE() { 
    // 默认使用同域反向代理，可在页面中覆盖 window.API_BASE
    return window.API_BASE || '/api';
  },
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
  enableCrawlCheckbox: null,
  crawlOptions: null,
  detectedPrefix: null,
  maxPagesInput: null,
  displayModeSelect: null,
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
    this.enableCrawlCheckbox = document.getElementById('enableCrawl');
    this.crawlOptions = document.getElementById('crawlOptions');
    this.detectedPrefix = document.getElementById('detectedPrefix');
    this.maxPagesInput = document.getElementById('maxPages');
    this.displayModeSelect = document.getElementById('displayMode');
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
// Crawl-related Functions
//=============================================================================

/**
 * 提取URL的路径前缀（用于crawl）
 * @throws {Error} 如果URL无效
 */
function extractPathPrefix(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // 规则1: 如果路径以.html/.htm/.php/.asp结尾，去掉文件名
    if (/\.(html?|php|asp)$/i.test(path)) {
      return path.substring(0, path.lastIndexOf('/') + 1);
    }
    
    // 规则2: 如果路径以/结尾，直接使用
    if (path.endsWith('/')) {
      return path;
    }
    
    // 规则3: 否则视为目录，添加/
    return path + '/';
    
  } catch (error) {
    throw new Error('Invalid URL for crawl prefix extraction');
  }
}

/**
 * 更新检测到的pathPrefix显示
 */
function updateDetectedPrefix() {
  const url = UIElements.urlInput.value.trim();
  if (!url) {
    UIElements.detectedPrefix.textContent = '/';
    return;
  }
  
  try {
    const prefix = extractPathPrefix(url);
    UIElements.detectedPrefix.textContent = prefix;
  } catch (error) {
    UIElements.detectedPrefix.textContent = '(无效的 URL)';
  }
}

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
 * 智能截断URL（保留协议和域名）
 */
function truncateUrl(url, maxLength = 60) {
  if (!url || url.length <= maxLength) return url;
  
  try {
    const parsed = new URL(url);
    const origin = parsed.origin; // 保留协议和域名
    const remaining = maxLength - origin.length - 3; // "..."占3个字符
    
    if (remaining > 10) {
      const path = parsed.pathname + parsed.search;
      return origin + path.substring(0, remaining) + '...';
    }
  } catch {
    // URL解析失败，回退到简单截断
  }
  
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * 更新进度消息（带URL，XSS安全）
 */
function updateProgressWithUrl(completed, total, currentUrl) {
  UIElements.errorDiv.textContent = '';
  UIElements.errorDiv.appendChild(createIcon('icon-spinner'));
  
  if (currentUrl) {
    const displayUrl = truncateUrl(currentUrl, 60);
    UIElements.errorDiv.appendChild(
      document.createTextNode(` 正在爬取：${completed}/${total} - ${displayUrl}`)
    );
  } else {
    UIElements.errorDiv.appendChild(
      document.createTextNode(` 正在爬取：${completed}/${total} 已完成`)
    );
  }
  
  UIElements.errorDiv.classList.add('show', 'info');
}

/**
 * 显示错误消息（XSS安全）
 * @param {string} message - 错误消息
 * @param {boolean} autoDismiss - 是否自动消失
 */
function showError(message, autoDismiss = false) {
  // 检查预览模式是否打开
  const previewMode = document.getElementById('previewMode');
  const isPreviewOpen = previewMode && previewMode.style.display === 'flex';
  
  if (isPreviewOpen) {
    // 使用预览模式专用Toast
    showPreviewToast(message, 'error', autoDismiss);
  } else {
    // 清理旧的timeout,避免堆积
    ToastState.clearMain();
    
    // 使用主界面Toast (errorDiv)
    UIElements.errorDiv.textContent = '';
    UIElements.errorDiv.appendChild(createIcon('icon-warning'));
    UIElements.errorDiv.appendChild(document.createTextNode(` ${message}`));
    UIElements.errorDiv.classList.add('show');
    UIElements.errorDiv.classList.remove('info');
    
    if (autoDismiss) {
      ToastState.mainTimeout = setTimeout(() => {
        UIElements.errorDiv.classList.remove('show');
        ToastState.mainTimeout = null;
      }, 3000);
    }
  }
}

/**
 * 显示成功消息（XSS安全）
 * @param {string} message - 成功消息
 * @param {boolean} autoDismiss - 是否自动消失
 */
function showSuccess(message, autoDismiss = true) {
  // 检查预览模式是否打开
  const previewMode = document.getElementById('previewMode');
  const isPreviewOpen = previewMode && previewMode.style.display === 'flex';
  
  if (isPreviewOpen) {
    // 使用预览模式专用Toast
    showPreviewToast(message, 'success', autoDismiss);
  } else {
    // 清理旧的timeout,避免堆积
    ToastState.clearMain();
    
    // 使用主界面Toast (errorDiv)
    UIElements.errorDiv.textContent = '';
    UIElements.errorDiv.appendChild(createIcon('icon-checkmark'));
    UIElements.errorDiv.appendChild(document.createTextNode(` ${message}`));
    UIElements.errorDiv.classList.add('show', 'info');
    
    if (autoDismiss) {
      ToastState.mainTimeout = setTimeout(() => {
        UIElements.errorDiv.classList.remove('show', 'info');
        ToastState.mainTimeout = null;
      }, 3000);
    }
  }
}

/**
 * 在预览模式中显示Toast
 * @param {string} message - 消息内容
 * @param {string} type - 'error' | 'success'
 * @param {boolean} autoDismiss - 是否自动消失
 */
function showPreviewToast(message, type, autoDismiss) {
  const toast = document.getElementById('previewToast');
  if (!toast) return;
  
  // 清理旧的timeout,避免堆积
  ToastState.clearPreview();
  
  // XSS安全: 使用textContent
  toast.textContent = message;
  toast.className = `preview-toast show ${type}`;
  
  if (autoDismiss) {
    ToastState.previewTimeout = setTimeout(() => {
      toast.classList.remove('show');
      ToastState.previewTimeout = null;
    }, 3000);
  }
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
    const response = await fetch(`${Config.API_BASE}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        renderJS: UIElements.renderJSCheckbox.checked,
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
 * 显示合并的crawl结果
 */
function displayMergedCrawlResults(data) {
  const timestamp = new Date().toLocaleDateString('zh-CN');
  const successPages = data.pages.filter(p => p.success);
  const failedPages = data.pages.filter(p => !p.success);
  
  let markdown = `# 爬取结果汇总 (${data.totalPages} 页)\n`;
  markdown += `> 路径前缀: ${extractPathPrefix(data.baseUrl)}\n`;
  markdown += `> 生成时间: ${timestamp}\n`;
  markdown += `> 成功: ${successPages.length} | 失败: ${failedPages.length}\n\n`;
  markdown += `---\n\n`;
  
  // 成功的页面
  if (successPages.length > 0) {
    successPages.forEach((page, index) => {
      markdown += `### 第 ${index + 1} 页: ${escapeMarkdown(page.url)}\n\n`;
      markdown += page.markdown || '';
      markdown += `\n\n---\n\n`;
    });
  }
  
  // 失败的页面
  if (failedPages.length > 0) {
    markdown += `## ❌ 失败的页面\n\n`;
    failedPages.forEach((page, index) => {
      markdown += `${index + 1}. ${escapeMarkdown(page.url)}\n`;
      markdown += `   错误: ${escapeMarkdown(page.error || 'Unknown error')}\n\n`;
    });
  }
  
  UIElements.markdownTextarea.value = markdown;
  UIElements.resultDiv.classList.add('show');
  
  // 标记为batch模式，用于下载文件名
  BatchProcessor.setBatchMode(true);
}

/**
 * 显示分页的crawl结果
 */
function displayPaginatedCrawlResults(data) {
  // 简化版：仅显示第一页 + 提示
  // 完整实现需要额外的UI元素（页面列表）
  
  if (data.pages.length === 0) {
    showError('未爬取到任何页面');
    return;
  }
  
  const firstPage = data.pages[0];
  
  // 显示第一页内容
  let markdown = `# 爬取结果 (共 ${data.totalPages} 页)\n\n`;
  markdown += `> 当前显示: 第 1 页\n`;
  markdown += `> 路径前缀: ${extractPathPrefix(data.baseUrl)}\n\n`;
  markdown += `## ${firstPage.url}\n\n`;
  markdown += firstPage.markdown || '';
  
  // 添加页面列表
  markdown += `\n\n---\n\n## 所有页面列表\n\n`;
  data.pages.forEach((page, index) => {
    const status = page.success ? '✓' : '✗';
    markdown += `${index + 1}. ${status} ${escapeMarkdown(page.url)}\n`;
  });
  
  UIElements.markdownTextarea.value = markdown;
  UIElements.resultDiv.classList.add('show');
  
  // 保存pages数据用于下载
  BatchProcessor.setBatchMode(true);
  data.pages.forEach(page => {
    BatchProcessor.addResult(page.url, page.markdown || '', page.success, page.error);
  });
}

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
    
    // 使用统一预览模式展示结果
    showPreview({
      title: data.title || '预览',
      url: url,
      markdown: data.markdown || ''
    }, false); // isBatch = false
    
  } catch (error) {
    showError(error.message);
  } finally {
    UIElements.submitBtn.disabled = false;
    UIElements.loading.style.display = 'none';
  }
}

/**
 * 处理crawl请求（使用SSE实时进度）
 */
async function handleCrawl(url) {
  UIElements.submitBtn.disabled = true;
  UIElements.loading.style.display = 'inline-flex';
  
  const pathPrefix = extractPathPrefix(url);
  const maxPages = parseInt(UIElements.maxPagesInput.value, 10);
  
  // 验证maxPages
  if (isNaN(maxPages) || maxPages < 1 || maxPages > 200) {
    showError('页数必须在 1-200 之间');
    UIElements.submitBtn.disabled = false;
    UIElements.loading.style.display = 'none';
    return;
  }
  
  updateProgress(0, maxPages);
  
  // 构建请求body
  const requestBody = {
    url: url,
    renderJS: UIElements.renderJSCheckbox.checked,
    pathPrefix: pathPrefix,
    maxPages: maxPages,
  };
  
  // Crawl通常需要更长时间，使用10分钟超时
  const crawlTimeout = 10 * 60 * 1000; // 10 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), crawlTimeout);
  
  try {
    // 使用SSE接收实时进度
    const response = await fetch(`${Config.API_BASE}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // 读取SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB 上限防止内存泄漏
    let buffer = '';
    let finalResult = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // 防止buffer无限增长
      if (buffer.length > MAX_BUFFER_SIZE) {
        reader.cancel();
        throw new Error('SSE流数据过大');
      }
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const event = JSON.parse(line.substring(6));
          
          if (event.type === 'progress') {
            // 更新进度显示（添加数值验证）
            const completed = Math.max(0, Number(event.completed) || 0);
            const total = Math.max(1, Number(event.total) || 1);
            updateProgressWithUrl(completed, total, event.currentUrl);
          } else if (event.type === 'result') {
            // 保存最终结果
            finalResult = event.data;
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Crawl failed');
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', line, parseError);
        }
      }
    }
    
    if (!finalResult) {
      throw new Error('未收到爬取结果');
    }
    
    if (!finalResult.success) {
      throw new Error(finalResult.error || '爬取失败');
    }
    
    // 使用统一预览模式展示结果
    showPreview({
      pages: finalResult.pages.map(p => ({
        title: p.title || '页面',
        url: p.url,
        markdown: p.markdown || ''
      }))
    }, true); // isBatch = true
    
    // 显示成功消息
    showSuccess(`爬取完成：共 ${finalResult.totalPages} 页`);
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // 分类错误以便更好的用户反馈
    if (error.name === 'AbortError') {
      showError('爬取超时，请减少页数或稍后重试');
    } else if (error.message.includes('Failed to fetch')) {
      showError('网络连接失败');
    } else {
      showError(`爬取失败：${error.message}`);
    }
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
  
  // 检查是否启用crawl模式
  if (UIElements.enableCrawlCheckbox.checked) {
    // Crawl模式：只能单个URL
    if (urls.length > 1) {
      showError('爬取模式下只能输入单个 URL');
      return;
    }
    handleCrawl(urls[0]);
  } else {
    // 普通模式：单页或批量
    if (urls.length > 1) {
      handleBatchScrape(urls);
    } else {
      handleSingleScrape(urls[0]);
    }
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
 * 处理enableCrawl checkbox变化
 */
function handleEnableCrawlChange() {
  const enabled = UIElements.enableCrawlCheckbox.checked;
  
  if (enabled) {
    // 显示crawl选项
    UIElements.crawlOptions.style.display = 'block';
    // 更新检测到的prefix
    updateDetectedPrefix();
  } else {
    // 隐藏crawl选项
    UIElements.crawlOptions.style.display = 'none';
  }
}

/**
 * 处理URL输入变化（更新pathPrefix）
 */
function handleUrlChange() {
  if (UIElements.enableCrawlCheckbox.checked) {
    updateDetectedPrefix();
  }
}

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
  
  // Crawl相关事件监听
  BatchProcessor.addEventListener(UIElements.enableCrawlCheckbox, 'change', handleEnableCrawlChange);
  BatchProcessor.addEventListener(UIElements.urlInput, 'blur', handleUrlChange);
  
  console.log('Firecrawl Lite initialized');
}

/**
 * 清理应用资源
 */
function destroyApp() {
  BatchProcessor.destroy();
  console.log('Firecrawl Lite cleaned up');
}

//=============================================================================
// Preview Mode Logic (Safari-style Unified Reader)
//=============================================================================

/**
 * 初始化预览模式事件监听器（仅执行一次）
 */
function initPreviewListeners() {
  if (PreviewState.initialized) return;
  
  const closeBtn = document.querySelector('#previewMode .close-btn');
  const doneBtn = document.querySelector('#previewMode .done-btn');
  const purifyBtn = document.getElementById('purifyBtn');
  const copyBtn = document.querySelector('#previewMode [data-action="copy"]');
  const exportBtn = document.querySelector('#previewMode [data-action="export"]');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (closeBtn) BatchProcessor.addEventListener(closeBtn, 'click', closePreview);
  if (doneBtn) BatchProcessor.addEventListener(doneBtn, 'click', closePreview);
  if (purifyBtn) BatchProcessor.addEventListener(purifyBtn, 'click', handlePurifyToggle);
  if (copyBtn) BatchProcessor.addEventListener(copyBtn, 'click', copyCurrentPage);
  if (exportBtn) BatchProcessor.addEventListener(exportBtn, 'click', exportCurrentPage);
  if (prevBtn) BatchProcessor.addEventListener(prevBtn, 'click', prevPage);
  if (nextBtn) BatchProcessor.addEventListener(nextBtn, 'click', nextPage);
  
  // 键盘导航
  BatchProcessor.addEventListener(window, 'keydown', handlePreviewKeyDown);
  
  // 手势支持（移动端）- 在showPreview中根据页数条件绑定
  
  PreviewState.initialized = true;
}

/**
 * 渲染所有页面
 */
function renderPages(pages) {
  const container = document.getElementById('previewContent');
  container.innerHTML = ''; // 清空
  
  pages.forEach((page, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.index = index;
    
    const inner = document.createElement('div');
    inner.className = 'page-inner';
    
    // 使用DOMPurify清理marked.parse的输出,防止XSS攻击
    const rawHtml = marked.parse(page.markdown);
    inner.innerHTML = DOMPurify.sanitize(rawHtml);
    
    wrapper.appendChild(inner);
    container.appendChild(wrapper);
  });
  
  // 初始化页面位置
  PreviewState.currentPageIndex = 0;
  updatePagePosition();
}

/**
 * 更新页面位置（翻页动画）
 */
function updatePagePosition() {
  const wrappers = document.querySelectorAll('.page-wrapper');
  wrappers.forEach((wrapper, index) => {
    if (index < PreviewState.currentPageIndex) {
      wrapper.style.transform = 'translateX(-100%)'; // 已翻过
      wrapper.style.visibility = 'hidden'; // 优化性能
    } else if (index > PreviewState.currentPageIndex) {
      wrapper.style.transform = 'translateX(100%)';  // 未翻到
      wrapper.style.visibility = 'hidden';
    } else {
      wrapper.style.transform = 'translateX(0)';     // 当前页
      wrapper.style.visibility = 'visible';
      wrapper.scrollTop = 0; // 重置滚动位置
    }
  });
  
  updateToolbar();
  updateProgressIndicator();
  
  // 更新提纯按钮显示状态 (动态显示/隐藏)
  const purifyBtn = document.getElementById('purifyBtn');
  const currentPage = PreviewState.pages[PreviewState.currentPageIndex];
  if (currentPage && detectNoisePatterns(currentPage.markdown)) {
    purifyBtn.style.display = 'inline-flex';
  } else {
    purifyBtn.style.display = 'none';
  }
}

/**
 * 更新工具栏
 */
function updateToolbar() {
  const totalPages = PreviewState.pages.length;
  const currentIndex = PreviewState.currentPageIndex;
  
  // 更新标题
  const titleEl = document.getElementById('pageTitle');
  const title = PreviewState.pages[currentIndex]?.title || '预览';
  titleEl.textContent = title;
  titleEl.setAttribute('aria-label', `第${currentIndex + 1}页，共${totalPages}页：${title}`);
  
  // 翻页控件（批量模式显示）
  const pagination = document.getElementById('pagination');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    
    const pageIndicator = pagination.querySelector('.page-indicator');
    pageIndicator.textContent = `${currentIndex + 1} / ${totalPages}`;
    pageIndicator.setAttribute('aria-live', 'polite');
    pageIndicator.setAttribute('role', 'status');
    
    // 更新按钮状态和ARIA
    prevBtn.disabled = currentIndex === 0;
    prevBtn.setAttribute('aria-label', currentIndex === 0 ? '已到第一页' : '上一页');
    
    nextBtn.disabled = currentIndex === totalPages - 1;
    nextBtn.setAttribute('aria-label', currentIndex === totalPages - 1 ? '已到最后一页' : '下一页');
  } else {
    pagination.style.display = 'none';
  }
}

/**
 * 更新进度指示器
 */
function updateProgressIndicator() {
  const indicator = document.getElementById('progressIndicator');
  const totalPages = PreviewState.pages.length;
  
  if (totalPages <= 1) {
    indicator.style.display = 'none';
    return;
  }
  
  indicator.style.display = 'flex';
  indicator.innerHTML = '';
  
  PreviewState.pages.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    if (index === PreviewState.currentPageIndex) {
      dot.classList.add('active');
    }
    indicator.appendChild(dot);
  });
}

//=============================================================================
// AI Purify Functions
//=============================================================================

/**
 * 检测Markdown内容是否包含噪音模式
 * @param {string} markdown - Markdown内容
 * @returns {boolean} - 是否检测到噪音
 */
function detectNoisePatterns(markdown) {
  if (!markdown) return false;
  
  const patterns = [
    /## Related Articles/i,
    /Subscribe to.*newsletter/i,
    /© \d{4}/,  // 版权声明
    /Follow us on/i,
    /Share this article/i,
    /Comments/i,
  ];
  
  // 超长内容也可能有噪音
  if (markdown.split('\n').length > 200) {
    return true;
  }
  
  // 检测是否匹配噪音模式
  return patterns.some(pattern => pattern.test(markdown));
}

/**
 * 统计Markdown中的标题数量
 * @param {string} markdown - Markdown内容
 * @returns {number} - 标题数量
 */
function countHeadings(markdown) {
  const headingPattern = /^#{1,6}\s+.+$/gm;
  const matches = markdown.match(headingPattern);
  return matches ? matches.length : 0;
}

/**
 * 验证提纯后的内容质量
 * @param {string} original - 原始Markdown
 * @param {string} purified - 提纯后Markdown
 * @returns {boolean} - 是否通过质量验证
 */
function validatePurifiedContent(original, purified) {
  if (!purified || purified.trim().length === 0) {
    return false;
  }
  
  return (
    purified.length > original.length * 0.7 && // 不能丢失超过30%
    countHeadings(purified) >= countHeadings(original) && // 保留所有标题
    /#{1,6}\s+/.test(purified) // 保持结构
  );
}

/**
 * 处理AI提纯请求
 * Note: 需要后端实现 POST /api/purify 端点
 * 接口规约: { content: string } -> { purified: string }
 */
async function handlePurify() {
  const btn = document.getElementById('purifyBtn');
  const pageIndex = PreviewState.currentPageIndex;
  const page = PreviewState.pages[pageIndex];
  
  if (!page) return;
  
  const originalMarkdown = page.markdown;
  
  // 检查缓存 - 立即应用(显示完成状态,不重复Loading)
  if (PreviewState.purifiedVersions.has(pageIndex)) {
    applyPurifiedVersion(pageIndex);
    return;
  }
  
  // Loading状态
  btn.innerHTML = '正在提纯...';
  btn.disabled = true;
  btn.classList.add('loading');
  
  try {
    const response = await fetch('/api/purify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: originalMarkdown }),
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const { purified } = await response.json();
    
    // 质量验证
    if (validatePurifiedContent(originalMarkdown, purified)) {
      PreviewState.purifiedVersions.set(pageIndex, purified);
      applyPurifiedVersion(pageIndex);
    } else {
      showError('提纯效果不理想，已保留原版', true);
      btn.innerHTML = '✨ 提纯';
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  } catch (error) {
    // API不可用时的优雅降级
    let message = '提纯服务暂时不可用';
    if (error.name === 'AbortError') {
      message = '提纯服务超时，请稍后重试';
    } else if (error instanceof TypeError) {
      message = '网络连接失败';
    }
    
    showError(message, true);
    btn.innerHTML = '✨ 提纯';
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

/**
 * 应用提纯后的版本
 * @param {number} pageIndex - 页面索引
 */
function applyPurifiedVersion(pageIndex) {
  const wrappers = document.querySelectorAll('.page-wrapper');
  const wrapper = wrappers[pageIndex];
  const purified = PreviewState.purifiedVersions.get(pageIndex);
  
  if (!wrapper || !purified) return;
  
  // 清理旧的pending timeout,防止动画中断问题
  if (wrapper.dataset.purifyTimeout) {
    clearTimeout(parseInt(wrapper.dataset.purifyTimeout));
    delete wrapper.dataset.purifyTimeout;
  }
  
  // 添加溶解动画
  wrapper.classList.add('dissolving');
  
  const timeoutId = setTimeout(() => {
    // 验证wrapper仍为当前页(防止页面切换导致更新错误页)
    if (PreviewState.currentPageIndex !== pageIndex) return;
    
    // 更新内容
    const rawHtml = marked.parse(purified);
    wrapper.querySelector('.page-inner').innerHTML = DOMPurify.sanitize(rawHtml);
    
    // 移除溶解动画,添加高亮动画
    wrapper.classList.remove('dissolving');
    wrapper.classList.add('purified');
    
    // 更新按钮状态
    const btn = document.getElementById('purifyBtn');
    btn.innerHTML = '✓ 已提纯';
    
    delete wrapper.dataset.purifyTimeout;
  }, 300);
  
  // 追踪timeout便于后续清理
  wrapper.dataset.purifyTimeout = timeoutId;
}

/**
 * 一键还原/提纯切换
 */
function handlePurifyToggle() {
  const pageIndex = PreviewState.currentPageIndex;
  const wrappers = document.querySelectorAll('.page-wrapper');
  const wrapper = wrappers[pageIndex];
  
  if (!wrapper) return;
  
  if (wrapper.classList.contains('purified')) {
    // 还原原版
    const page = PreviewState.pages[pageIndex];
    const rawHtml = marked.parse(page.markdown);
    wrapper.querySelector('.page-inner').innerHTML = DOMPurify.sanitize(rawHtml);
    wrapper.classList.remove('purified');
    
    const btn = document.getElementById('purifyBtn');
    btn.innerHTML = '🔍 提纯';
  } else {
    // 应用提纯版
    handlePurify();
  }
}

/**
 * 显示预览模式（统一入口）
 */
function showPreview(data, isBatch) {
  // 统一数据格式: 单页包装成数组
  PreviewState.pages = isBatch ? data.pages : [{
    title: data.title || '预览',
    url: data.url,
    markdown: data.markdown
  }];
  
  // 绑定事件监听器（仅首次初始化）
  initPreviewListeners();
  
  // 渲染页面
  renderPages(PreviewState.pages);
  
  // 绑定手势事件（批量模式）- 先解绑再绑定
  unbindGestureEvents();
  bindGestureEvents();
  
  // 智能显示提纯按钮 (检测当前页)
  const purifyBtn = document.getElementById('purifyBtn');
  const currentPage = PreviewState.pages[PreviewState.currentPageIndex];
  if (currentPage && detectNoisePatterns(currentPage.markdown)) {
    purifyBtn.style.display = 'inline-flex';
    purifyBtn.innerHTML = '🔍 提纯'; // 重置按钮文本
  } else {
    purifyBtn.style.display = 'none';
  }
  
  // 显示预览容器
  document.getElementById('previewMode').style.display = 'flex';
}

/**
 * 关闭预览模式
 */
function closePreview() {
  document.getElementById('previewMode').style.display = 'none';
  
  // 重置状态
  PreviewState.reset();
}

/**
 * 复制当前页（占位函数）
 */
function copyCurrentPage() {
  if (!PreviewState.pages || PreviewState.pages.length === 0) {
    showError('没有可复制的内容');
    return;
  }
  
  const page = PreviewState.pages[PreviewState.currentPageIndex];
  const markdown = page.markdown || '';
  
  navigator.clipboard.writeText(markdown)
    .then(() => {
      showSuccess('已复制到剪贴板'); // autoDismiss默认为true
    })
    .catch((error) => {
      showError('复制失败: ' + error.message, true); // 错误也自动消失
    });
}

/**
 * 导出当前页
 */
function exportCurrentPage() {
  if (!PreviewState.pages || PreviewState.pages.length === 0) {
    showError('没有可导出的内容', true);
    return;
  }
  
  const page = PreviewState.pages[PreviewState.currentPageIndex];
  const markdown = page.markdown || '';
  const title = page.title || '预览';
  
  // 清理文件名（移除非法字符）
  const sanitizedFilename = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // 移除文件系统非法字符
    .replace(/\s+/g, '-')                   // 空格转为连字符
    .trim()                                  // 移除首尾空白
    .substring(0, 100)                       // 限制长度
    .replace(/^-+|-+$/g, '');                // 移除首尾连字符
  
  const filename = sanitizedFilename || 'export';
  
  // 创建Blob并下载
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
  
  showSuccess('已导出文件');
}

/**
 * 上一页
 */
function prevPage() {
  if (PreviewState.currentPageIndex > 0) {
    PreviewState.currentPageIndex--;
    updatePagePosition();
  }
}

/**
 * 下一页
 */
function nextPage() {
  if (PreviewState.currentPageIndex < PreviewState.pages.length - 1) {
    PreviewState.currentPageIndex++;
    updatePagePosition();
  }
}

/**
 * AI提纯切换（占位函数）
 */
function handlePurifyToggle() {
  // TODO: Phase 5 - 实现AI提纯逻辑
  console.log('Purify toggle');
}

/**
 * 键盘导航处理
 */
function handlePreviewKeyDown(e) {
  // 仅在预览模式打开时响应
  const previewMode = document.getElementById('previewMode');
  if (previewMode.style.display !== 'flex') return;
  
  const totalPages = PreviewState.pages.length;
  const currentIndex = PreviewState.currentPageIndex;
  
  // ESC键关闭预览（单页和批量都支持）
  if (e.key === 'Escape') {
    closePreview();
    e.preventDefault();
    return;
  }
  
  // 翻页键仅批量模式有效
  if (totalPages <= 1) return;
  
  if (e.key === 'ArrowLeft' && currentIndex > 0) {
    prevPage();
    e.preventDefault();
  } else if (e.key === 'ArrowRight' && currentIndex < totalPages - 1) {
    nextPage();
    e.preventDefault();
  }
}

/**
 * 手势支持 - Touch事件处理
 */
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

function handleTouchStart(e) {
  touchStartX = e.targetTouches[0].clientX;
  touchStartY = e.targetTouches[0].clientY;
}

function handleTouchMove(e) {
  touchEndX = e.targetTouches[0].clientX;
  touchEndY = e.targetTouches[0].clientY;
}

function handleTouchEnd() {
  const deltaX = touchStartX - touchEndX;
  const deltaY = touchStartY - touchEndY;
  
  // 垂直滚动优先 - 计算滑动角度
  const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
  
  // 如果角度接近垂直(60°-120°),优先处理为滚动
  if (angle > 60 && angle < 120) {
    return;
  }
  
  // 响应式阈值(屏幕宽度的20%，但不少于50px，不超过150px)
  const threshold = Math.max(50, Math.min(150, window.innerWidth * 0.2));
  
  if (deltaX > threshold) {
    // 向左滑动 → 下一页
    nextPage();
  } else if (deltaX < -threshold) {
    // 向右滑动 → 上一页
    prevPage();
  }
}

/**
 * 绑定/解绑手势事件
 */
function bindGestureEvents() {
  const content = document.getElementById('previewContent');
  if (!content) return;
  
  // 仅批量模式绑定手势
  if (PreviewState.pages.length <= 1) return;
  
  // 先解绑旧手势
  unbindGestureEvents();
  
  // 绑定新手势(手动管理,支持passive选项)
  content.addEventListener('touchstart', handleTouchStart, { passive: true });
  content.addEventListener('touchmove', handleTouchMove, { passive: true });
  content.addEventListener('touchend', handleTouchEnd);
  
  // 手动注册到cleanup列表
  PreviewState.gestureListeners = [
    { element: content, event: 'touchstart', handler: handleTouchStart, options: { passive: true } },
    { element: content, event: 'touchmove', handler: handleTouchMove, options: { passive: true } },
    { element: content, event: 'touchend', handler: handleTouchEnd }
  ];
}

function unbindGestureEvents() {
  if (!PreviewState.gestureListeners || PreviewState.gestureListeners.length === 0) return;
  
  PreviewState.gestureListeners.forEach(({ element, event, handler, options }) => {
    element.removeEventListener(event, handler, options);
  });
  PreviewState.gestureListeners = [];
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initApp);

// 页面卸载时清理
window.addEventListener('beforeunload', destroyApp);
window.addEventListener('unload', destroyApp);
