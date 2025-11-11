/**
 * Firecrawl Lite - Configuration Module
 * 
 * 外部化的应用配置，便于部署和修改
 * 支持环境变量覆盖（DEV vs PROD）
 */

const AppConfig = {
  // 应用信息
  appName: 'Firecrawl Lite',
  appDescription: '将任意网页转换为干净、结构化的 Markdown 格式',
  tagline: '简约而不简单',
  
  // 外部链接
  links: {
    github: 'https://github.com',
    healthCheck: '/health',
  },
  
  // 功能配置
  features: {
    maxBatchSize: 50,
    requestTimeout: 30000, // 30 seconds
    supportedProtocols: ['http:', 'https:'],
  },
  
  // UI配置
  ui: {
    buttonSuccessDuration: 2000, // milliseconds
    progressDebounce: 100, // milliseconds
    textareaMaxRows: 8,
  },
  
  // 文本标签（国际化基础）
  labels: {
    submit: '开始抓取',
    urlPlaceholder: 'https://example.com',
    urlLabel: '网页地址（支持多行批量输入）',
    renderJSLabel: '渲染 JavaScript（较慢，适用于单页应用）',
    autoClickTabsLabel: '自动点击标签页（适用于文档站点）',
    copy: '复制',
    download: '下载',
    copied: '已复制',
    downloaded: '已下载',
    error: '复制失败',
  },
  
  // 错误消息
  errors: {
    invalidUrls: '请输入有效的 URL（仅支持 http:// 和 https://）',
    batchSizeExceeded: (max, actual) => `批量抓取最多支持 ${max} 个 URL，当前 ${actual} 个`,
    timeout: '请求超时',
    networkError: '网络连接失败',
    batchFailed: (error) => `批量抓取出错：${error}`,
  },
  
  // 成功消息
  messages: {
    batchComplete: (success, fail) => `批量抓取完成：${success} 成功，${fail} 失败`,
    copied: '已复制到剪贴板',
    downloaded: '文件已下载',
    processing: (completed, total) => `正在批量抓取：${completed}/${total} 已完成`,
  },
  
  /**
   * 获取配置值，支持嵌套路径
   * @param {string} path - 点分路径，如 'links.github'
   * @param {*} defaultValue - 默认值
   * @returns {*} 配置值
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  },
  
  /**
   * 设置配置值（用于运行时覆盖）
   * @param {string} path - 点分路径
   * @param {*} value - 新值
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let obj = this;
    
    for (const key of keys) {
      if (!(key in obj) || typeof obj[key] !== 'object') {
        obj[key] = {};
      }
      obj = obj[key];
    }
    
    obj[lastKey] = value;
  },
};

// 如果有环境变量，进行覆盖
if (typeof window !== 'undefined') {
  // DEV环境特殊配置
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    AppConfig.set('links.github', 'https://github.com/ai-alchemy-factory/firecrawl-lite');
  }
}
