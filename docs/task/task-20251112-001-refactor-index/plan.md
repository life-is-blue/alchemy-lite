# Firecrawl Lite - Apple式极简结果展示重构

## Executive Summary

**需求来源**：PC端布局优化，提升用户体验和Markdown预览能力

**核心问题**：
1. 当前HTML转Markdown噪音过多（导航、广告、版权声明）
2. PC端空间利用率低（单列布局）
3. 缺少Markdown实时预览
4. 批量爬取结果展示混乱

**解决方案**：
采用**Safari阅读器 + Apple Books**启发的**统一翻页式阅读器**，抛弃复杂分栏和独立页面方案，实现全屏沉浸式内容展示。单页和批量模式复用同一套UI组件（代码复用率>95%），通过翻页而非滚动浏览批量内容。

---

## Current State

### 技术栈
- 前端：原生HTML + CSS + JavaScript（无框架）
- 后端：Express + Puppeteer + Cheerio
- 部署：Docker + Caddy（自动HTTPS）

### 现有结构
```
public/
├── index.html      # 单页应用（输入表单 + 结果textarea）
├── style.css       # 极简样式
└── app.js          # 抓取逻辑（单页/批量/爬取）
```

### 当前体验问题
1. **单页抓取**：结果显示在`<textarea>`中，无渲染预览
2. **批量爬取**：两种模式
   - 合并模式：所有页面拼接成一个Markdown → 无法单独查看
   - 分页模式：在输入页面切换显示 → 体验混乱
3. **PC端**：表单和结果垂直堆叠 → 大屏空间浪费

---

## Design Philosophy

**灵感来源**：
- Safari阅读器模式：统一工具栏 + 翻页交互
- Apple Books：章节导航 + 阅读进度
- Apple HomePod Mini产品页：极简留白 + 内容优先

### Apple的极简主义原则

1. **Content is the Interface** - 内容即界面
   - 移除一切装饰性元素
   - 60%留白 + 40%内容
   - 产品（内容）是唯一主角

2. **Progressive Disclosure** - 渐进式信息披露
   - 长滚动单页（一次只看一个模块）
   - 每个模块独立视口（100vh）
   - 大量留白隔离不同主题

3. **Minimal Interaction** - 最少交互
   - 主要操作：滚动（最自然）
   - 次要操作：点击浮动按钮
   - 零学习成本

4. **Invisible Design** - 隐形设计
   - UI退居幕后
   - 设计消失，内容说话

### 对Firecrawl Lite的应用

**核心理念**：一个阅读器，无限内容

**单页抓取** → 全屏Markdown预览（类似Safari阅读器）  
**批量爬取** → 左右翻页浏览（类似Apple Books）  
**AI增强** → 隐形提纯（类似iPhone实况文本）

**统一性**：单页和批量使用同一套组件，只是翻页控件的显示/隐藏不同

---

## Proposed Future State

### 布局架构（统一预览模式）

```
输入页（index.html保持原样）
    ↓ 用户提交
┌─────────────────────────────────────────────────────┐
│ 全屏阅读器 (PreviewMode)                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ × [标题]         ✨ 📋 ⬇️  [< 2/5 >]  完成    │ │ ← 统一工具栏(60px)
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │                                                 │ │
│ │          Markdown 渲染内容                      │ │ ← 内容区域
│ │          (max-width: 680px)                     │ │   (翻页切换)
│ │                                                 │ │
│ │          单页模式：无翻页控件                    │ │
│ │          批量模式：显示 [< 2/5 >] + 进度圆点    │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│                   ○●○○○                            │ ← 进度指示器
│                                                     │   (批量时显示)
└─────────────────────────────────────────────────────┘

交互方式：
- 单页：上下滚动阅读
- 批量：左右翻页(按钮/键盘/手势)
```

### 技术实现

**Markdown渲染**：marked.js (8KB gzipped)
```html
<script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script>
```

**翻页动画**：CSS transform + 平滑过渡
```css
.page-wrapper {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0); /* 当前页 */
}
```

**手势支持**：TouchEvent API
```javascript
// 左右滑动翻页（移动端）
handleTouchStart/Move/End
```

**布局**：fixed全屏覆盖层
```css
.preview-container {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  z-index: 1000;
}
```

**AI提纯**：隐形魔法按钮
```javascript
// 智能判断是否显示提纯按钮
if (detectsNoisePatterns(markdown)) {
  showPurifyButton();
}
```

---

## Implementation Phases

### Phase 1: 基础结构（30分钟）

**目标**：创建结果视图容器和基础逻辑

#### 1.1 HTML结构
在`index.html`底部添加：
```html
<div id="previewMode" class="preview-container" style="display: none;">
  <!-- 统一工具栏 -->
  <div class="preview-toolbar">
    <button class="close-btn" onclick="closePreview()">×</button>
    <h1 class="title" id="pageTitle">加载中...</h1>
    <div class="actions">
      <button class="action-btn" id="purifyBtn" style="display: none;">
        ✨ 提纯
      </button>
      <button class="action-btn" onclick="copyCurrentPage()">📋 复制</button>
      <button class="action-btn" onclick="exportCurrentPage()">⬇️ 导出</button>
      
      <!-- 翻页控件（批量时显示） -->
      <div class="pagination" id="pagination" style="display: none;">
        <button onclick="prevPage()" id="prevBtn" disabled>‹</button>
        <span class="page-indicator" id="pageIndicator">1 / 1</span>
        <button onclick="nextPage()" id="nextBtn" disabled>›</button>
      </div>
    </div>
    <button class="done-btn" onclick="closePreview()">完成</button>
  </div>
  
  <!-- 内容区域（多页面） -->
  <div class="preview-content" id="previewContent">
    <!-- 动态生成 .page-wrapper -->
  </div>
  
  <!-- 进度指示器（批量时显示） -->
  <div class="progress-indicator" id="progressIndicator" style="display: none;">
    <!-- 动态生成圆点 -->
  </div>
</div>
```

**Acceptance Criteria**：
- HTML结构添加到index.html底部
- 初始状态`display: none`
- 包含统一工具栏和内容区域

#### 1.2 引入marked.js
```html
<script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script>
```

**Acceptance Criteria**：
- CDN引用添加到`<head>`
- 浏览器Console无加载错误

#### 1.3 显示/隐藏逻辑
在`app.js`中添加：
```javascript
function showPreview(data, isBatch) {
  document.getElementById('previewMode').style.display = 'flex';
  // 实现后续渲染...
}

function closePreview() {
  document.getElementById('previewMode').style.display = 'none';
  // 重置状态
  currentPageIndex = 0;
  pages = [];
}
```

**Acceptance Criteria**：
- 点击关闭按钮 → 预览区隐藏
- 输入区恢复可见
- 状态正确重置

---

### Phase 2: 统一预览模式（40分钟）

**目标**：实现单页/批量通用的阅读器组件

#### 2.1 统一渲染逻辑
```javascript
// 统一入口函数
function showPreview(data, isBatch) {
  const pages = isBatch ? data.pages : [{
    title: data.title || '预览',
    url: data.url,
    markdown: data.markdown
  }];
  
  renderPages(pages);
  updateToolbar(pages.length);
  document.getElementById('previewMode').style.display = 'flex';
}

// 渲染所有页面
function renderPages(pages) {
  const container = document.getElementById('previewContent');
  container.innerHTML = ''; // 清空
  
  pages.forEach((page, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.index = index;
    wrapper.innerHTML = `
      <div class="page-inner">
        ${marked.parse(page.markdown)}
      </div>
    `;
    container.appendChild(wrapper);
  });
  
  // 初始化页面位置
  currentPageIndex = 0;
  updatePagePosition();
}
```

**Acceptance Criteria**：
- 单页数据自动包装成数组
- Markdown正确渲染为HTML
- 标题、段落、代码块样式正常

#### 2.2 工具栏样式
在`style.css`中添加：
```css
.preview-toolbar {
  height: 60px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.close-btn {
  font-size: 32px;
  color: #007AFF;
  background: none;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
}

.title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 32px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 16px;
}

.page-indicator {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  text-align: center;
}
```

**Acceptance Criteria**：
- 工具栏固定顶部，60px高度
- Apple字体系统生效（-apple-system）
- 毛玻璃效果在Safari生效

#### 2.3 内容区域样式
```css
.preview-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.page-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-inner {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

/* Markdown排版 */
.page-inner h1 {
  font-size: 42px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 24px;
}

.page-inner p {
  font-size: 18px;
  line-height: 1.7;
  margin-bottom: 16px;
}
```

**Acceptance Criteria**：
- 内容最大宽度680px（可读性最优）
- 行高1.7，字号18px
- 上下内边40px

---

### Phase 3: 翻页交互（45分钟）

**目标**：实现左右翻页、手势支持、进度指示

#### 3.1 翻页逻辑
```javascript
let currentPageIndex = 0;
let pages = [];

function updatePagePosition() {
  const wrappers = document.querySelectorAll('.page-wrapper');
  wrappers.forEach((wrapper, index) => {
    if (index < currentPageIndex) {
      wrapper.style.transform = 'translateX(-100%)'; // 已翻过
    } else if (index > currentPageIndex) {
      wrapper.style.transform = 'translateX(100%)';  // 未翻到
    } else {
      wrapper.style.transform = 'translateX(0)';     // 当前页
    }
  });
  
  updateToolbar(pages.length);
  updateProgressIndicator();
}

function changePage(newIndex) {
  if (newIndex < 0 || newIndex >= pages.length) return;
  currentPageIndex = newIndex;
  updatePagePosition();
}

function prevPage() {
  changePage(currentPageIndex - 1);
}

function nextPage() {
  changePage(currentPageIndex + 1);
}
```

**Acceptance Criteria**：
- 点击翻页按钮 → 平滑切换页面
- 第一页禁用上一页按钮
- 最后一页禁用下一页按钮
- 动画时长300ms，曲线`cubic-bezier(0.4, 0, 0.2, 1)`

#### 3.2 手势支持（移动端）
```javascript
let touchStart = 0;
let touchEnd = 0;

function handleTouchStart(e) {
  touchStart = e.targetTouches[0].clientX;
}

function handleTouchMove(e) {
  touchEnd = e.targetTouches[0].clientX;
}

function handleTouchEnd() {
  if (touchStart - touchEnd > 75) {
    // 向左滑动 → 下一页
    nextPage();
  }
  
  if (touchStart - touchEnd < -75) {
    // 向右滑动 → 上一页
    prevPage();
  }
}

// 绑定事件（仅批量模式）
if (pages.length > 1) {
  const content = document.getElementById('previewContent');
  content.addEventListener('touchstart', handleTouchStart);
  content.addEventListener('touchmove', handleTouchMove);
  content.addEventListener('touchend', handleTouchEnd);
}
```

**Acceptance Criteria**：
- 左滑动 → 下一页
- 右滑动 → 上一页
- 阈值75px（防止误触）
- 单页模式禁用手势

#### 3.3 键盘导航
```javascript
function handleKeyDown(e) {
  if (pages.length <= 1) return; // 单页模式禁用
  
  if (e.key === 'ArrowLeft' && currentPageIndex > 0) {
    prevPage();
  }
  
  if (e.key === 'ArrowRight' && currentPageIndex < pages.length - 1) {
    nextPage();
  }
  
  if (e.key === 'Escape') {
    closePreview();
  }
}

window.addEventListener('keydown', handleKeyDown);
```

**Acceptance Criteria**：
- ← 方向键 → 上一页
- → 方向键 → 下一页
- ESC键 → 关闭预览
- 单页模式禁用翻页键

#### 3.4 进度指示器
```javascript
function updateProgressIndicator() {
  const indicator = document.getElementById('progressIndicator');
  
  if (pages.length <= 1) {
    indicator.style.display = 'none';
    return;
  }
  
  indicator.style.display = 'flex';
  indicator.innerHTML = '';
  
  pages.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    if (index === currentPageIndex) {
      dot.classList.add('active');
    }
    indicator.appendChild(dot);
  });
}
```

```css
.progress-indicator {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.progress-dot.active {
  width: 20px;
  border-radius: 3px;
  background: #007AFF;
}
```

**Acceptance Criteria**：
- 底部显示圆点指示器
- 当前页圆点变长并高亮
- 单页模式隐藏指示器
- 动画过渡流畅

#### 3.5 工具栏更新逻辑
```javascript
function updateToolbar(totalPages) {
  const title = pages[currentPageIndex]?.title || '预览';
  document.getElementById('pageTitle').textContent = title;
  
  // 翻页控件
  const pagination = document.getElementById('pagination');
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('pageIndicator').textContent = 
      `${currentPageIndex + 1} / ${totalPages}`;
    
    document.getElementById('prevBtn').disabled = currentPageIndex === 0;
    document.getElementById('nextBtn').disabled = 
      currentPageIndex === totalPages - 1;
  } else {
    pagination.style.display = 'none';
  }
}
```

**Acceptance Criteria**：
- 标题显示当前页面标题
- 批量模式显示页码 `2 / 5`
- 单页模式隐藏翻页控件
- 禁用按钮样式正确

---

### Phase 4: 打磨（20分钟）

**目标**：响应式适配和细节优化

#### 4.1 响应式
```css
@media (max-width: 768px) {
  .preview-toolbar {
    height: 52px;
    padding: 0 16px;
  }
  
  .title {
    font-size: 15px;
  }
  
  .action-btn {
    font-size: 13px;
    padding: 4px 8px;
  }
  
  .page-inner {
    padding: 24px 16px 60px;
  }
}
```

**Acceptance Criteria**：
- 移动端工具栏高度52px
- 内边距从40px → 20px
- 字体大小保持可读

#### 4.2 复制/导出功能适配
```javascript
function copyCurrentPage() {
  const markdown = pages[currentPageIndex].markdown;
  navigator.clipboard.writeText(markdown);
  showToast('已复制');
}

function exportCurrentPage() {
  const page = pages[currentPageIndex];
  const blob = new Blob([page.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(page.title)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Acceptance Criteria**：
- 单页模式：复制/导出当前页
- 批量模式：复制/导出当前页
- 复制后显示Tips

#### 4.3 修改handleScrape/handleCrawl调用
```javascript
// 单页抓取
async function handleSingleScrape(url) {
  const data = await scrapeURL(url);
  // OLD: UIElements.markdownTextarea.value = data.markdown;
  // NEW:
  showPreview({
    title: data.title,
    url: url,
    markdown: data.markdown
  }, false); // isBatch = false
}

// 批量爬取
async function handleCrawl(url) {
  const result = await crawlURL(...);
  // OLD: displayMergedCrawlResults(result);
  // NEW:
  showPreview({
    pages: result.pages.map(p => ({
      title: p.title,
      url: p.url,
      markdown: p.markdown
    }))
  }, true); // isBatch = true
}
```

**Acceptance Criteria**：
- 单页抓取 → 预览展开
- 批量爬取 → 翻页预览
- 原有textarea逻辑已删除

---

### Phase 5: AI增强功能（45分钟）

**目标**：实现“隐形魔法”风格AI提纯功能

#### 5.1 智能判断显示提纯按钮
```javascript
function detectNoisePatterns(markdown) {
  const patterns = [
    /## Related Articles/i,
    /Subscribe to.*newsletter/i,
    /© \d{4}/,  // 版权声明
    /Follow us on/i,
  ];
  
  // 超长内容也可能有噪音
  if (markdown.split('\n').length > 200) {
    return true;
  }
  
  return patterns.some(pattern => pattern.test(markdown));
}

function showPreview(data, isBatch) {
  // ... 现有逻辑 ...
  
  // 智能显示提纯按钮
  if (detectNoisePatterns(data.markdown)) {
    document.getElementById('purifyBtn').style.display = 'block';
  }
}
```

**Acceptance Criteria**：
- 检测到常见噪音模式 → 显示按钮
- 干净内容 → 隐藏按钮
- 按钮默认`display: none`

#### 5.2 AI提纯API调用
```javascript
let purifiedVersions = new Map(); // 缓存提纯结果

async function handlePurify() {
  const btn = document.getElementById('purifyBtn');
  const originalMarkdown = pages[currentPageIndex].markdown;
  
  // 检查缓存
  if (purifiedVersions.has(currentPageIndex)) {
    applyPurifiedVersion(currentPageIndex);
    return;
  }
  
  // Loading状态
  btn.innerHTML = '◐ 提纯中...';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/purify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: originalMarkdown }),
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    
    const { purified } = await response.json();
    
    // 质量验证
    if (validatePurifiedContent(originalMarkdown, purified)) {
      purifiedVersions.set(currentPageIndex, purified);
      applyPurifiedVersion(currentPageIndex);
    } else {
      showToast('提纯效果不理想，已保留原版');
    }
  } catch (error) {
    showToast('提纯服务暂时不可用');
  } finally {
    btn.innerHTML = '✨ 提纯';
    btn.disabled = false;
  }
}

function validatePurifiedContent(original, purified) {
  return (
    purified.length > original.length * 0.7 && // 不能丢失超过30%
    countHeadings(purified) >= countHeadings(original) && // 保留所有标题
    /#{1,6} /.test(purified) // 保持结构
  );
}
```

**Acceptance Criteria**：
- 点击提纯 → Loading状态（1-3秒）
- API调用3秒超时
- 质量验证防止过度删除
- 缓存结果（同页不重复AI调用）

#### 5.3 溶解动画
```javascript
function applyPurifiedVersion(pageIndex) {
  const wrapper = document.querySelectorAll('.page-wrapper')[pageIndex];
  const purified = purifiedVersions.get(pageIndex);
  
  // 添加动画类
  wrapper.classList.add('dissolving');
  
  setTimeout(() => {
    wrapper.querySelector('.page-inner').innerHTML = marked.parse(purified);
    wrapper.classList.remove('dissolving');
    wrapper.classList.add('purified');
    
    // 更新按钮状态
    document.getElementById('purifyBtn').innerHTML = '↶ 已提纯';
  }, 300);
}
```

```css
@keyframes dissolve {
  to {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    filter: blur(4px);
  }
}

.dissolving .page-inner {
  animation: dissolve 0.3s ease-out;
}

@keyframes highlight {
  0%, 100% { background: transparent; }
  50% { background: rgba(52, 199, 89, 0.1); }
}

.purified .page-inner {
  animation: highlight 0.4s ease-out;
}
```

**Acceptance Criteria**：
- 内容溶解消失（0.3s）
- 新内容绿色闪烁（0.4s）
- 动画流畅，无卡顿
- 按钮变为“↑已提纯”

#### 5.4 一键还原
```javascript
function handlePurifyToggle() {
  const pageIndex = currentPageIndex;
  const wrapper = document.querySelectorAll('.page-wrapper')[pageIndex];
  
  if (wrapper.classList.contains('purified')) {
    // 还原原版
    const original = pages[pageIndex].markdown;
    wrapper.querySelector('.page-inner').innerHTML = marked.parse(original);
    wrapper.classList.remove('purified');
    document.getElementById('purifyBtn').innerHTML = '✨ 提纯';
  } else {
    // 应用提纯版
    handlePurify();
  }
}
```

**Acceptance Criteria**：
- 点击“已提纯” → 立刻还原原版
- 无网络请求（使用缓存）
- 再次点击提纯 → 立刻应用（使用缓存）
- 按钮文案切换正确

---

## Risk Assessment

### 技术风险

| 风险 | 影响 | 概率 | 应对方案 |
|------|------|------|---------|
| marked.js渲染性能差（大文件） | 卡顿 | 低 | 使用Web Worker异步渲染 |
| backdrop-filter兼容性 | 毛玻璃失效 | 低 | 降级为纯色背景 |
| Intersection Observer兼容性 | 渐显失效 | 极低 | 现代浏览器全支持，无需polyfill |

### 用户体验风险

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| 用户不知道如何返回 | 困惑 | 返回按钮始终可见（左上角） |
| 批量模式滚动迷失 | 方向感丧失 | 滚动进度指示器 + 每页显示URL |
| 结果刷新丢失 | 数据丢失 | 未来可考虑localStorage持久化 |

---

## Success Metrics

### 用户体验指标
- ✅ 单页抓取：从提交到预览 < 1秒
- ✅ Markdown渲染：代码块、表格、图片正确显示
- ✅ 批量翻页：翻页动画流畅（300ms）
- ✅ AI提纯：响应时间 < 3秒
- ✅ 移动端：手势支持，滚动流畅

### 技术指标
- ✅ 代码量：HTML +60行，CSS +120行，JS +250行
- ✅ 依赖大小：marked.js 8KB
- ✅ 动画帧率：60fps（Chrome/Safari）
- ✅ 代码复用率：>95%（单页/批量统一组件）
- ✅ 动画帧率：60fps（Chrome/Safari）

### 维护性指标
- ✅ 无框架依赖（原生实现）
- ✅ 代码简洁（遵循Linus哲学）
- ✅ 易于扩展（模块化结构）

---

## Timeline Estimates

| Phase | 时长 | 累计 |
|-------|------|------|
| Phase 1: 基础结构 | 30分钟 | 0.5小时 |
| Phase 2: 统一预览模式 | 40分钟 | 1.17小时 |
| Phase 3: 翻页交互 | 45分钟 | 1.92小时 |
| Phase 4: 打磨 | 20分钟 | 2.25小时 |
| Phase 5: AI增强 | 45分钟 | 3小时 |

**总计：3小时**

---

## Dependencies

### 外部库
- **marked.js v11+** (8KB gzipped)
  - 用途：Markdown → HTML渲染
  - 来源：CDN (jsdelivr)
  - 许可：MIT

### 浏览器API
- Intersection Observer（现代浏览器原生支持）
- backdrop-filter（Safari 9+，Chrome 76+）
- CSS Grid/Flexbox（IE11+）

---

## Future Enhancements

### 短期（Phase 5已实现）
1. **AI提纯功能** ✅
   - “✨ 提纯”按钮
   - 智能噪音检测
   - 溶解动画
   - 一键还原

2. **统一阅读器** ✅
   - 单页/批量复用组件
   - Safari阅读器风格工具栏
   - 翻页而非滚动

### 中期（下个版本）
1. **AI增强迭代**
   - 多次优化（更激进/更保守）
   - 用户标注（双击选中 → “移除类似内容”）
   - 用户偏好持久化（localStorage）

2. **结果持久化**
   - localStorage缓存最近10条结果
   - URL参数传递结果ID
   - 刷新页面不丢失

### 长期
1. **离线Markdown编辑器**
   - 在结果页直接编辑内容
   - 实时预览同步
   - 保存为本地文件

2. **批量导出增强**
   - ZIP打包（引入JSZip）
   - PDF生成（引入jsPDF）
   - EPUB格式（电子书）

---

## Reference

### 设计灵感
- **Safari阅读器模式**：统一工具栏 + 翻页交互
- **Apple Books**：章节导航 + 阅读进度 + 手势支持
- **Apple HomePod Mini页面**: https://www.apple.com.cn/homepod-mini/
  - 极简留白
  - 内容优先
  - 渐进式信息披露
- **iPhone实况文本**：隐形AI（用户甚至意识不到这是AI）

### 技术文档
- **marked.js**: https://marked.js.org/
- **Intersection Observer**: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- **Apple Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/

---

## Approval

**User**: 确认执行  
**Date**: 2025-11-12  
**Status**: ✅ Approved
