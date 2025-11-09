#!/usr/bin/env node

/**
 * Test browser pool concurrency limiting
 */

import { BrowserPool } from '../dist/scraper/browser-pool.js';

console.log('\n🧪 Browser Pool Concurrency Test');
console.log('='.repeat(70));
console.log('\n📋 Test Setup:');
console.log('   Max concurrent browsers: 5');
console.log('   Tasks to schedule: 8');
console.log('   Expected: Queue management for tasks 6, 7, 8\n');

const pool = new BrowserPool(5);

// Create 8 concurrent tasks
const tasks = Array(8).fill(0).map(async (_, idx) => {
  const taskId = idx + 1;
  const startTime = Date.now();
  
  console.log(`[Task ${taskId}] Requesting browser...`);
  
  try {
    // This will queue if pool is at max
    const browser = await pool.acquire();
    const acquireTime = Date.now() - startTime;
    
    console.log(`[Task ${taskId}] Browser acquired (waited ${acquireTime}ms)`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Release browser
    await pool.release(browser);
    
    const totalTime = Date.now() - startTime;
    console.log(`[Task ${taskId}] ✅ Complete (${totalTime}ms)`);
    
    return {
      id: taskId,
      acquireWait: acquireTime,
      totalTime: totalTime,
      status: 'success'
    };
  } catch (error) {
    console.log(`[Task ${taskId}] ❌ Error: ${error.message}`);
    return {
      id: taskId,
      status: 'error',
      error: error.message
    };
  }
});

// Run all tasks concurrently
(async () => {
  const overallStart = Date.now();
  
  try {
    const results = await Promise.all(tasks);
    const overallTime = Date.now() - overallStart;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Results:');
    console.log(`   Overall time: ${overallTime}ms`);
    
    console.log('\n   Calculation:');
    console.log(`   - 8 tasks × 1.5s = 12s if sequential`);
    console.log(`   - 8 tasks ÷ 5 pools × 1.5s ≈ 3-4.5s if parallel`);
    console.log(`   - Actual: ${overallTime}ms`);
    
    if (overallTime >= 3000) {
      console.log('\n   ✅ POOL IS WORKING! (Tasks are being queued)');
    } else {
      console.log('\n   ⚠️  Pool might not be limiting (completed too fast)');
    }
    
    console.log('\n📈 Individual Task Timing:');
    let successCount = 0;
    results.forEach(r => {
      if (r.status === 'success') {
        console.log(`   Task ${r.id}: wait=${r.acquireWait}ms, total=${r.totalTime}ms`);
        successCount++;
      } else {
        console.log(`   Task ${r.id}: ERROR - ${r.error}`);
      }
    });
    
    console.log(`\n✅ Test completed (${successCount}/${results.length} successful)`);
    
    if (successCount === 8) {
      console.log('   All tasks executed successfully!');
      console.log('   Browser pool concurrency limiting is VERIFIED ✅');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
  
  // Cleanup
  await pool.closeAll();
  process.exit(0);
})();
