#!/usr/bin/env node

/**
 * Quality verification test
 * - Fetches URLs and saves original HTML
 * - Converts to Markdown
 * - Analyzes quality metrics
 */

import { scrape } from '../dist/scraper/index.js';
import fs from 'fs';
import path from 'path';

const urlsFile = 'tests/url.txt';
const outputDir = 'tests/output';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const urls = fs.readFileSync(urlsFile, 'utf8')
  .split('\n')
  .map(u => u.trim())
  .filter(u => u.length > 0);

console.log(`Testing ${urls.length} URLs\n`);
console.log('='.repeat(80));

let totalScore = 0;
let successCount = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const urlName = `url${i + 1}`;
  
  console.log(`\n[${i + 1}/${urls.length}] ${url}`);
  console.log('-'.repeat(80));
  
  try {
    // Try fast mode first
    let result = await scrape({ url, renderJS: false });
    let mode = 'fast';
    
    // If content is too short, try browser mode
    if (result.success && result.markdown.length < 100) {
      console.log('  ⚠️  Content too short, retrying with browser mode...');
      result = await scrape({ url, renderJS: true });
      mode = 'browser';
    }
    
    if (!result.success) {
      console.log(`  ❌ FAILED: ${result.error}`);
      continue;
    }
    
    // Save original HTML
    const htmlPath = path.join(outputDir, `${urlName}.html`);
    fs.writeFileSync(htmlPath, result.html);
    
    // Save converted Markdown
    const mdPath = path.join(outputDir, `${urlName}.md`);
    fs.writeFileSync(mdPath, result.markdown);
    
    // Analyze quality
    const md = result.markdown;
    const metrics = {
      length: md.length,
      lines: md.split('\n').length,
      headings: (md.match(/^#+\s/gm) || []).length,
      codeBlocks: (md.match(/```/g) || []).length / 2,
      images: (md.match(/!\[.*?\]\(.*?\)/g) || []).length,
      links: (md.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length,
      absoluteLinks: (md.match(/\[.*?\]\(https:\/\/.*?\)/g) || []).length,
      chineseChars: (md.match(/[\u4e00-\u9fa5]/g) || []).length,
    };
    
    // Quality scoring (0-10)
    let score = 0;
    let reasons = [];
    
    // Content length
    if (metrics.length > 1000) {
      score += 2;
      reasons.push('✅ Rich content');
    } else if (metrics.length > 200) {
      score += 1;
      reasons.push('⚠️  Moderate content');
    } else {
      reasons.push('❌ Sparse content');
    }
    
    // Structure
    if (metrics.headings > 3) {
      score += 2;
      reasons.push('✅ Good structure');
    } else if (metrics.headings > 0) {
      score += 1;
      reasons.push('⚠️  Basic structure');
    }
    
    // Links quality
    if (metrics.links > 0 && metrics.absoluteLinks === metrics.links) {
      score += 2;
      reasons.push('✅ All links absolute');
    } else if (metrics.links > 0) {
      score += 1;
      reasons.push('⚠️  Some relative links');
    }
    
    // Images
    if (metrics.images > 0) {
      score += 2;
      reasons.push('✅ Images preserved');
    }
    
    // Code blocks (if present)
    if (metrics.codeBlocks > 0) {
      score += 1;
      reasons.push('✅ Code blocks found');
    }
    
    // Chinese support (if applicable)
    if (metrics.chineseChars > 100) {
      score += 1;
      reasons.push('✅ Chinese supported');
    }
    
    console.log(`  ✅ SUCCESS (${mode} mode)`);
    console.log(`  📊 Metrics:`);
    console.log(`     Length: ${metrics.length} chars`);
    console.log(`     Headings: ${metrics.headings}`);
    console.log(`     Code blocks: ${metrics.codeBlocks}`);
    console.log(`     Images: ${metrics.images}`);
    console.log(`     Links: ${metrics.links} (${metrics.absoluteLinks} absolute)`);
    console.log(`  📈 Score: ${score}/10`);
    console.log(`     ${reasons.join('\n     ')}`);
    console.log(`  💾 Saved: ${htmlPath}, ${mdPath}`);
    
    totalScore += score;
    successCount++;
    
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('FINAL RESULTS');
console.log('='.repeat(80));
console.log(`Success rate: ${successCount}/${urls.length} (${Math.round(successCount/urls.length*100)}%)`);
if (successCount > 0) {
  const avgScore = (totalScore / successCount).toFixed(1);
  console.log(`Average quality: ${avgScore}/10`);
  
  let verdict = '';
  if (avgScore >= 8) verdict = '🏆 Excellent';
  else if (avgScore >= 6) verdict = '✅ Good';
  else if (avgScore >= 4) verdict = '⚠️  Acceptable';
  else verdict = '❌ Needs improvement';
  
  console.log(`Verdict: ${verdict}`);
}
console.log('\nAll outputs saved to tests/output/');
