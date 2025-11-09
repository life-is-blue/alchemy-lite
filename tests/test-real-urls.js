#!/usr/bin/env node

/**
 * 真实 URL 验证测试
 * 使用 Firecrawl Lite 的实际爬虫功能对真实网站进行测试
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read URLs from url.txt
const urlFile = path.join(__dirname, 'url.txt');
const allUrls = fs.readFileSync(urlFile, 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url.length > 0 && url.startsWith('http'));

// Select diverse URLs for testing (skip google which needs special handling)
const urls = [
  allUrls[0], // https://docs.cnb.cool/zh/artifact/intro.html - Static HTML
  allUrls[1], // https://platform.moonshot.cn/docs/api/chat - JS rendered
  allUrls[2], // https://developer.work.weixin.qq.com/document/path/99914 - JS rendered
  allUrls[4], // https://ai.google.dev/gemini-api/docs?hl=zh-cn - React app
  allUrls[5], // https://github.com/XTLS/Xray-core/discussions/1295 - GitHub
];

// URLs that need JS rendering
const jsRenderDomains = [
  'platform.moonshot.cn',
  'developer.work.weixin.qq.com',
  'ai.google.dev',
  'github.com'
];

function needsJsRendering(url) {
  return jsRenderDomains.some(domain => url.includes(domain));
}

console.log(`\n🚀 Firecrawl Lite 真实网站验证测试`);
console.log(`📋 测试 ${urls.length} 个 URL\n`);
console.log(`测试策略:`);
console.log(`- 静态 HTML: 使用快速 HTTP 引擎`);
console.log(`- JS 渲染: 使用 Puppeteer 引擎\n`);

// Wait for server startup
await new Promise(resolve => setTimeout(resolve, 1000));

async function scrapeUrl(url, index) {
  const startTime = Date.now();
  const useJs = needsJsRendering(url);
  
  try {
    const response = await fetch('http://localhost:3000/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url,
        renderJS: useJs,
        autoClickTabs: useJs,
        timeout: 30000
      })
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    if (data.success && data.markdown) {
      const textLength = (data.markdown || '').length;
      const lines = (data.markdown || '').split('\n').length;
      const engine = useJs ? '🔥 Puppeteer' : '⚡ HTTP';
      console.log(`✅ [${index}] ${engine} - 成功 (${duration}ms)`);
      console.log(`   URL: ${url}`);
      console.log(`   内容: ${lines} 行, ${textLength} 字符`);
      
      // Show first 60 chars of content
      const preview = data.markdown.substring(0, 60).replace(/\n/g, ' ');
      console.log(`   内容预览: ${preview}...`);
      
      return { url, success: true, duration, textLength, lines, engine };
    } else {
      console.log(`⚠️  [${index}] 返回空内容 (${duration}ms)`);
      console.log(`   URL: ${url}`);
      return { url, success: false, duration, error: '空内容' };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ [${index}] 异常 (${duration}ms)`);
    console.log(`   URL: ${url}`);
    console.log(`   异常: ${error.message}`);
    return { url, success: false, duration, error: error.message };
  }
}

// Test each URL sequentially
const results = [];
console.log(`\n📝 开始爬取...\n`);

for (let i = 0; i < urls.length; i++) {
  const result = await scrapeUrl(urls[i], i + 1);
  results.push(result);
  
  // 等待1.5秒再进行下一个
  if (i < urls.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// Summary
const successful = results.filter(r => r.success).length;
const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
const totalContent = results.reduce((sum, r) => sum + (r.textLength || 0), 0);

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 验证结果统计`);
console.log(`${'='.repeat(60)}`);
console.log(`✅ 成功: ${successful}/${results.length}`);
console.log(`⏱️  总耗时: ${totalDuration}ms`);
console.log(`📄 总内容: ${totalContent} 字符`);
console.log(`📈 平均耗时: ${Math.round(totalDuration / results.length)}ms/URL`);
console.log(`🔥 使用 Puppeteer: ${results.filter(r => r.engine === '🔥 Puppeteer').length} 个`);
console.log(`⚡ 使用 HTTP: ${results.filter(r => r.engine === '⚡ HTTP').length} 个\n`);

if (successful === results.length) {
  console.log(`✨ 所有测试通过！Firecrawl Lite 生产就绪 ✨\n`);
} else {
  console.log(`⚠️  部分测试未获取到内容，可能需要更多时间渲染\n`);
}

// Detailed summary table
console.log(`\n📋 详细结果\n`);
console.log(`${'#'.padEnd(3)} | ${'耗时'.padEnd(8)} | ${'行数'.padEnd(6)} | ${'字符'.padEnd(8)} | 状态`);
console.log(`${'─'.repeat(60)}`);

results.forEach((r, i) => {
  const status = r.success ? '✅ 成功' : '⚠️  空内容';
  const lines = r.lines ? r.lines.toString().padEnd(6) : '-'.padEnd(6);
  const chars = r.textLength ? r.textLength.toString().padEnd(8) : '-'.padEnd(8);
  console.log(`${(i+1).toString().padEnd(3)} | ${r.duration.toString().padEnd(8)} | ${lines} | ${chars} | ${status}`);
});
