# Frontend - Firecrawl Lite UI

独立的静态前端应用,通过 REST API 与后端通信。

## 技术栈

- 原生 HTML5 + CSS3 + JavaScript (ES6+)
- 无框架依赖,纯静态部署
- 总大小: 272KB (未压缩)

## 文件清单

- `index.html` - UI 入口,Safari风格单页应用
- `app.js` - 核心逻辑:表单处理、批量抓取、预览模式、手势支持
- `config.js` - API配置模块 (支持运行时覆盖)
- `styles.css` - 响应式样式,支持暗色模式
- `icons.svg` - SVG图标集 (copy/download/preview icons)
- `image.png` - Logo资源

## 本地开发

### 方式A: 独立运行 (需手动配置API)

```bash
cd public
python3 -m http.server 8080 --bind 127.0.0.1
```

在浏览器控制台设置API地址:
```javascript
window.API_BASE = 'http://localhost:3000/api';
```

访问 http://localhost:8080

### 方式B: Caddy反向代理 (推荐,零配置)

```bash
# 终端1: 启动后端
cd .. && npm run dev

# 终端2: 启动前端
cd public && python3 -m http.server 8080 --bind 127.0.0.1

# 终端3: 启动代理
caddy run --config ../config/Caddyfile
```

访问 http://localhost:8000 (API自动路由到 `/api`)

**Caddy配置** (`config/Caddyfile`):
```caddyfile
:8000 {
  route /api* { reverse_proxy localhost:3000 }
  route /*     { reverse_proxy localhost:8080 }
}
```

## API集成

### 配置说明

`config.js` 提供动态API配置:

```javascript
const AppConfig = {
  API_BASE: window.API_BASE || '/api', // 默认同域代理
  features: {
    maxBatchSize: 50,
    requestTimeout: 30000
  }
};
```

**环境变量覆盖**:
- 开发环境: `window.API_BASE = 'http://localhost:3000/api'`
- 生产环境: 默认 `/api` (Caddy反向代理)

### API端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/scrape` | POST | 单页抓取 |
| `/api/crawl` | POST | 批量爬虫 (支持SSE流式) |

详细API规范见 [../docs/FRONTEND.md](../docs/FRONTEND.md)

## 功能特性

### 核心功能

- ✅ 单页抓取/批量爬取
- ✅ 实时进度显示 (SSE流式)
- ✅ Safari式统一预览模式
- ✅ 批量下载 (ZIP/Markdown合并)
- ✅ 移动端手势支持 (左右滑动切换)
- ✅ 键盘快捷键 (←/→ 导航, Esc退出)

### 响应式设计

- Desktop: 最大宽度800px居中布局
- Mobile: 全屏自适应,触摸优化
- 支持暗色模式 (基于系统偏好)

## 测试

```bash
# 前端功能测试 (需后端运行在localhost:3000)
npm run test:frontend
```

测试覆盖:
- 单页抓取完整流程
- 批量爬取 + 进度监听
- 手势/键盘导航
- 浏览器兼容性 (Chrome/Safari)

**测试文件**: `tests/preview-mode.test.js`

## 独立部署

### Vercel (推荐)

```bash
# vercel.json 已配置静态资源路径
vercel deploy --prod
```

**环境变量**:
```bash
BACKEND_DOMAIN=api.your-domain.com
```

`vercel.json` 配置:
```json
{
  "outputDirectory": "public",
  "rewrites": [{
    "source": "/api/:path*",
    "destination": "https://${BACKEND_DOMAIN}/api/:path*"
  }]
}
```

### Netlify

```bash
netlify deploy --prod --dir=public
```

创建 `netlify.toml`:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.your-domain.com/api/:splat"
  status = 200
```

### Cloudflare Pages

```bash
wrangler pages publish public
```

创建 `public/_redirects`:
```
/api/* https://api.your-domain.com/api/:splat 200
```

## 性能指标

- 首次加载: ~300KB (含图片)
- Gzip压缩后: ~80KB
- FCP (First Contentful Paint): <1s
- TTI (Time to Interactive): <1.5s

## 浏览器兼容性

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- 移动端: iOS 14+, Android Chrome 90+

---

**集成部署**: 见 [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)  
**API调用模式**: 见 [../docs/FRONTEND.md](../docs/FRONTEND.md)  
**后端快速启动**: 见 [../README.md](../README.md)
