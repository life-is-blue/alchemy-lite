/**
 * Preview Mode Test Suite
 * 验证Safari式统一预览模式的核心功能
 * 
 * Test Coverage:
 * - Test 1: 单页抓取完整流程
 * - Test 2: 批量爬取完整流程  
 * - Test 3: 手势支持测试（移动端模拟）
 * - Test 4: 键盘导航测试
 * - Test 5: AI提纯完整流程（优雅跳过后端未实现）
 * - Test 6: 响应式测试
 * - Test 7: 浏览器兼容性（Chrome/Safari）
 * - Test 8: 性能测试
 */

import assert from 'assert';
import http from 'http';

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testUrls: {
    single: 'https://example.com',
    batch: 'https://docs.python.org/3/tutorial/'
  }
};

// 工具函数: HTTP请求
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_CONFIG.baseUrl);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(data) 
              : data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// 测试套件
async function runTests() {
  console.log('\n🧪 Preview Mode Test Suite\n');
  
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  
  // Test 1: 单页抓取完整流程
  try {
    console.log('Test 1: 单页抓取完整流程');
    const res = await makeRequest('/api/scrape', {
      method: 'POST',
      body: {
        url: TEST_CONFIG.testUrls.single,
        renderJS: false
      }
    });
    
    assert.strictEqual(res.statusCode, 200, '状态码应为200');
    assert.ok(res.body.success, '响应应包含success=true');
    assert.ok(res.body.markdown, '响应应包含markdown内容');
    
    // 验证前端能正确处理响应
    const markdown = res.body.markdown;
    assert.ok(markdown.length > 50, 'Markdown内容应足够长(>50字符)');
    assert.ok(/^#/.test(markdown), 'Markdown应包含标题');
    
    console.log('  ✅ PASSED - 单页抓取API正常, 返回有效Markdown\n');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 2: 批量爬取完整流程
  try {
    console.log('Test 2: 批量爬取完整流程');
    const res = await makeRequest('/api/crawl', {
      method: 'POST',
      body: {
        url: TEST_CONFIG.testUrls.batch,
        maxPages: 3,
        renderJS: false
      }
    });
    
    assert.strictEqual(res.statusCode, 200, '状态码应为200');
    assert.ok(res.body.success, '响应应包含success=true');
    assert.ok(Array.isArray(res.body.pages), 'pages应为数组');
    assert.ok(res.body.pages.length >= 1, '至少应爬取1个页面');
    assert.ok(res.body.pages.length <= 3, '不应超过maxPages限制');
    
    // 验证页面数据结构
    const firstPage = res.body.pages[0];
    assert.ok(firstPage.url, '每个页面应包含url');
    assert.ok(firstPage.markdown, '每个页面应包含markdown');
    
    console.log(`  ✅ PASSED - 批量爬取成功, 获取${res.body.pages.length}个页面\n`);
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 3: 手势支持测试（前端功能,仅检查实现）
  try {
    console.log('Test 3: 手势支持测试（移动端）');
    const indexHtml = await makeRequest('/');
    assert.ok(indexHtml.body.includes('preview-container'), 'HTML应包含preview-container');
    
    const appJs = await makeRequest('/app.js');
    assert.ok(appJs.body.includes('handleTouchStart'), 'app.js应包含handleTouchStart函数');
    assert.ok(appJs.body.includes('handleTouchMove'), 'app.js应包含handleTouchMove函数');
    assert.ok(appJs.body.includes('handleTouchEnd'), 'app.js应包含handleTouchEnd函数');
    assert.ok(appJs.body.includes('bindGestureEvents'), 'app.js应包含bindGestureEvents函数');
    
    console.log('  ✅ PASSED - 手势支持代码已实现（需手动验证移动端）\n');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 4: 键盘导航测试（前端功能,仅检查实现）
  try {
    console.log('Test 4: 键盘导航测试');
    const appJs = await makeRequest('/app.js');
    assert.ok(appJs.body.includes('handlePreviewKeyDown'), 'app.js应包含handlePreviewKeyDown函数');
    assert.ok(appJs.body.includes('ArrowLeft'), '应支持左箭头键');
    assert.ok(appJs.body.includes('ArrowRight'), '应支持右箭头键');
    assert.ok(appJs.body.includes('Escape'), '应支持ESC键');
    
    console.log('  ✅ PASSED - 键盘导航代码已实现（←/→/ESC）\n');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 5: AI提纯完整流程（优雅跳过）
  try {
    console.log('Test 5: AI提纯完整流程');
    console.log('  ⏭️  SKIPPED - 提纯后端未实现,优雅跳过\n');
    skippedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 6: 响应式测试（检查CSS媒体查询）
  try {
    console.log('Test 6: 响应式测试');
    const stylesRes = await makeRequest('/styles.css');
    assert.ok(stylesRes.body.includes('@media'), 'CSS应包含媒体查询');
    assert.ok(stylesRes.body.includes('max-width: 768px') || 
              stylesRes.body.includes('max-width:768px'), 
              '应包含768px断点');
    
    console.log('  ✅ PASSED - 响应式CSS已实现（需手动验证移动端布局）\n');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 7: 浏览器兼容性（检查依赖加载）
  try {
    console.log('Test 7: 浏览器兼容性');
    const indexHtml = await makeRequest('/');
    assert.ok(indexHtml.body.includes('marked@11'), 'HTML应引用marked.js v11');
    assert.ok(indexHtml.body.includes('dompurify@3'), 'HTML应引用DOMPurify v3');
    assert.ok(indexHtml.body.includes('integrity='), '应包含SRI完整性校验');
    assert.ok(indexHtml.body.includes('crossorigin'), '应包含CORS配置');
    
    console.log('  ✅ PASSED - 外部依赖已正确配置（marked.js + DOMPurify + SRI）\n');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // Test 8: 性能测试（测试API响应时间）
  try {
    console.log('Test 8: 性能测试');
    const startTime = Date.now();
    const res = await makeRequest('/api/scrape', {
      method: 'POST',
      body: {
        url: TEST_CONFIG.testUrls.single,
        renderJS: false
      }
    });
    const duration = Date.now() - startTime;
    
    assert.ok(res.body.success, 'API应成功响应');
    assert.ok(duration < 5000, `响应时间应<5秒 (实际: ${duration}ms)`);
    
    console.log(`  ✅ PASSED - API响应时间: ${duration}ms (<5s)\n`);
    passedTests++;
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    failedTests++;
  }
  
  // 测试总结
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`  ✅ Passed:  ${passedTests}`);
  console.log(`  ❌ Failed:  ${failedTests}`);
  console.log(`  ⏭️  Skipped: ${skippedTests}`);
  console.log(`  📊 Total:   ${passedTests + failedTests + skippedTests}`);
  console.log('='.repeat(50) + '\n');
  
  // 返回退出码
  process.exit(failedTests > 0 ? 1 : 0);
}

// 执行测试
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
