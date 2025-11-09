#!/usr/bin/env node

/**
 * Tab Clicking Comparison Test
 * 对比 autoClickTabs: true vs false 的内容质量差异
 */

const url = 'https://platform.moonshot.cn/docs/api/chat';

async function testWithTabs(enableTabs) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 测试 ${enableTabs ? '✅ 打开标签点击' : '❌ 关闭标签点击'}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3000/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        renderJS: true,
        autoClickTabs: enableTabs,
        timeout: 30000
      })
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (data.success && data.markdown) {
      const lines = data.markdown.split('\n').length;
      const chars = data.markdown.length;
      
      // 分析内容
      const hasCodeBlocks = (data.markdown.match(/```/g) || []).length / 2;
      const hasHeadings = (data.markdown.match(/^#+\s/gm) || []).length;
      const hasList = (data.markdown.match(/^[-*]\s/gm) || []).length;
      const hasTable = (data.markdown.match(/^\|/gm) || []).length > 0;

      console.log(`⏱️  耗时: ${duration}ms`);
      console.log(`\n📊 内容统计:`);
      console.log(`  行数:    ${lines}`);
      console.log(`  字符:    ${chars}`);
      console.log(`  代码块:  ${hasCodeBlocks} 个`);
      console.log(`  标题:    ${hasHeadings} 个`);
      console.log(`  列表:    ${hasList} 项`);
      console.log(`  表格:    ${hasTable ? '✅ 有' : '❌ 无'}`);

      // 显示前 500 字符
      console.log(`\n📝 内容预览 (前 300 字符):`);
      console.log(`${'─'.repeat(60)}`);
      console.log(data.markdown.substring(0, 300).replace(/\n/g, '\n  '));
      console.log(`${'─'.repeat(60)}\n`);

      // 分析特定关键词（Python/Node/Curl 代码示例）
      const hasPython = data.markdown.includes('python') || data.markdown.includes('Python');
      const hasNodejs = data.markdown.includes('node') || data.markdown.includes('Node');
      const hasCurl = data.markdown.includes('curl') || data.markdown.includes('Curl');

      console.log(`🔍 语言示例检测:`);
      console.log(`  Python: ${hasPython ? '✅' : '❌'}`);
      console.log(`  Node.js: ${hasNodejs ? '✅' : '❌'}`);
      console.log(`  Curl:    ${hasCurl ? '✅' : '❌'}`);

      return {
        success: true,
        duration,
        lines,
        chars,
        codeBlocks: hasCodeBlocks,
        headings: hasHeadings,
        lists: hasList,
        hasTable,
        hasPython,
        hasNodejs,
        hasCurl,
        markdown: data.markdown
      };
    } else {
      console.log(`❌ 失败: ${data.error}`);
      return { success: false, error: data.error, duration };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ 异常: ${error.message}`);
    return { success: false, error: error.message, duration };
  }
}

async function main() {
  console.log(`\n${'╔' + '═'.repeat(58) + '╗'}`);
  console.log(`║ Moonshot API 文档 - Tab 点击效果对比分析 ║`.padEnd(61) + '║');
  console.log(`${'╚' + '═'.repeat(58) + '╝'}\n`);

  // 测试不点击标签
  const withoutTabs = await testWithTabs(false);

  console.log(`\n⏳ 等待 3 秒再测试打开标签点击...\n`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 测试点击标签
  const withTabs = await testWithTabs(true);

  // 对比分析
  if (withoutTabs.success && withTabs.success) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 对比分析结果`);
    console.log(`${'═'.repeat(60)}\n`);

    const charDiff = withTabs.chars - withoutTabs.chars;
    const charDiffPercent = ((charDiff / withoutTabs.chars) * 100).toFixed(1);
    const timeDiff = withTabs.duration - withoutTabs.duration;

    console.log(`⏱️  耗时对比:`);
    console.log(`  不点击标签: ${withoutTabs.duration}ms`);
    console.log(`  点击标签:   ${withTabs.duration}ms`);
    console.log(`  增加耗时:   ${timeDiff}ms (${((timeDiff / withoutTabs.duration) * 100).toFixed(1)}%)\n`);

    console.log(`📄 内容对比:`);
    console.log(`  不点击标签: ${withoutTabs.chars} 字符, ${withoutTabs.lines} 行`);
    console.log(`  点击标签:   ${withTabs.chars} 字符, ${withTabs.lines} 行`);
    console.log(`  增加内容:   ${charDiff} 字符 (${charDiffPercent}%)\n`);

    console.log(`🔧 功能完整性对比:`);
    const features = [
      { name: 'Python 示例', without: withoutTabs.hasPython, with: withTabs.hasPython },
      { name: 'Node.js 示例', without: withoutTabs.hasNodejs, with: withTabs.hasNodejs },
      { name: 'Curl 示例', without: withoutTabs.hasCurl, with: withTabs.hasCurl },
      { name: '代码块', without: withoutTabs.codeBlocks > 0, with: withTabs.codeBlocks > 0 },
      { name: '标题', without: withoutTabs.headings > 0, with: withTabs.headings > 0 },
      { name: '列表', without: withoutTabs.lists > 0, with: withTabs.lists > 0 },
    ];

    features.forEach(f => {
      const improvement = !f.without && f.with ? ' ← 改善!' : f.without && !f.with ? ' ← 退步!' : '';
      console.log(`  ${f.name}:`);
      console.log(`    不点击: ${f.without ? '✅' : '❌'}`);
      console.log(`    点击:   ${f.with ? '✅' : '❌'}${improvement}`);
    });

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 结论`);
    console.log(`${'═'.repeat(60)}\n`);

    if (charDiff > 1000) {
      console.log(`✅ 值得 - 增加了 ${charDiffPercent}% 的内容，代价是 ${timeDiff}ms`);
      console.log(`   建议: 保持 autoClickTabs: true (默认)\n`);
    } else if (charDiff > 0) {
      console.log(`⚠️  略有改善 - 增加了 ${charDiffPercent}% 的内容，代价是 ${timeDiff}ms`);
      console.log(`   建议: 可选配置 (客户端决定)\n`);
    } else {
      console.log(`❌ 没有改善 - 内容完全相同，但耗时增加 ${timeDiff}ms`);
      console.log(`   建议: 设为 false (默认)\n`);
    }

    // 从性价比角度分析
    console.log(`💰 性价比分析:`);
    const contentPerMs = charDiff / timeDiff;
    console.log(`  每 1ms 增加 ${contentPerMs.toFixed(2)} 字符`);
    
    if (contentPerMs > 1) {
      console.log(`  高效率 ✅ - 值得点击标签\n`);
    } else if (contentPerMs > 0.3) {
      console.log(`  中等效率 ⚠️ - 可选\n`);
    } else {
      console.log(`  低效率 ❌ - 不值得\n`);
    }
  }
}

main();
