#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read URLs from url.txt
const urlFile = path.join(__dirname, 'url.txt');
const urls = fs.readFileSync(urlFile, 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url.length > 0 && url.startsWith('http'));

console.log(`\n📋 验证测试清单`);
console.log(`共 ${urls.length} 个 URL 待验证\n`);

// Test each URL with fetch
async function testUrl(url, index) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Firecrawl-Lite/1.0.0)'
      }
    });
    const duration = Date.now() - startTime;
    const status = response.status;
    const contentType = response.headers.get('content-type') || 'unknown';
    
    const statusEmoji = status >= 200 && status < 300 ? '✅' : status >= 300 && status < 400 ? '🔄' : '❌';
    console.log(`${statusEmoji} [${index}] (${duration}ms) ${status} - ${url}`);
    console.log(`   Content-Type: ${contentType}`);
    
    return { url, status, duration, success: status >= 200 && status < 300 };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ [${index}] (${duration}ms) ERROR - ${url}`);
    console.log(`   ${error.message}`);
    return { url, error: error.message, duration, success: false };
  }
}

// Run tests
console.log(`🚀 开始验证...\n`);
const startAll = Date.now();

const results = await Promise.all(urls.map((url, i) => testUrl(url, i + 1)));

const totalDuration = Date.now() - startAll;
const successful = results.filter(r => r.success).length;
const failed = results.length - successful;

console.log(`\n📊 验证结果统计`);
console.log(`✅ 成功: ${successful}/${results.length}`);
console.log(`❌ 失败: ${failed}/${results.length}`);
console.log(`⏱️  总耗时: ${totalDuration}ms`);
console.log(`📈 平均耗时: ${Math.round(totalDuration / results.length)}ms/URL\n`);

// Detailed report
console.log(`📄 详细报告\n`);
results.forEach((result, i) => {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} URL ${i + 1}: ${result.url}`);
  if (result.status) {
    console.log(`   Status: ${result.status}`);
  }
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  console.log(`   耗时: ${result.duration}ms`);
});

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
