# Firecrawl Lite - 部署指南

## 本地开发

**快速启动（推荐）：**
```bash
# 终端 1：启动后端
npm run dev

# 终端 2：启动前端
cd public && python3 -m http.server 8080

# 终端 3：启动反向代理（可选，统一入口）
caddy run --config Caddyfile
```

**访问地址：**
- 使用 Caddy：http://localhost:8000（推荐）
- 直接访问：前端 http://localhost:8080 + 后端 http://localhost:3000

**Caddy 配置说明（Caddyfile）：**
```caddyfile
:8000 {
  route /api* { reverse_proxy localhost:3000 }
  route /*     { reverse_proxy localhost:8080 }
}
```
- 监听 8000 端口
- `/api/*` 转发到后端，`/*` 转发到前端
- 无需手动配置 CORS

---

## 生产部署

### 架构

```
用户 → https://example.com
  ↓
反向代理（Cloudflare/Caddy/Nginx）
  ├─ /         → 前端静态文件
  └─ /api/*    → 后端 API
```

**核心思想：** 一个域名，反向代理路由，前后端独立部署。

---

## 部署步骤

### 第1步：代码改动（已完成）

前端和后端都已配置完毕：

**前端改动：**
- `public/app.js`: API调用使用 `Config.API_BASE` 配置
- `public/config.js`: healthCheck链接改为 `/api/health`

**后端改动：**
- 删除了 `express.static('public')` - 前端由Cloudflare Pages托管
- API路由添加 `/api` 前缀：
  - `/health` → `/api/health`
  - `/scrape` → `/api/scrape`
  - `/crawl` → `/api/crawl`

### 第2步：本地测试

**方案 A：使用 Caddy（推荐）**
```bash
# 终端 1：启动后端
npm run dev

# 终端 2：启动前端
cd public && python3 -m http.server 8080

# 终端 3：启动 Caddy 反向代理
caddy run --config Caddyfile

# 访问 http://localhost:8000
# 前端: http://localhost:8000/
# API: http://localhost:8000/api/health
```

**方案 B：分别访问**
```bash
npm run dev
# 后端 http://localhost:3000/api/health

cd public && python3 -m http.server 8080
# 前端 http://localhost:8080
# 需在浏览器 console 设置: window.API_BASE = 'http://localhost:3000/api'
```

### 第3步：部署到Railway

**前提条件：**
- 有Railway账户（https://railway.app）
- 安装了CLI：`npm install -g @railway/cli`

**部署步骤：**

```bash
# 1. 创建一个新的GitHub仓库或连接现有的
# 确保代码已push到GitHub

# 2. 在Railway Dashboard创建新项目
# 选择 "Deploy from GitHub"

# 3. 或使用CLI部署
railway login
cd /path/to/firecrawl-lite
railway init
railway link

# 4. 设置环境变量
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set LOG_LEVEL=info
railway variables set MAX_BROWSERS=2
railway variables set MAX_CRAWL_DEPTH=2
railway variables set MAX_CRAWL_PAGES=30

# 可选：启用API认证（生成32字符随机密钥）
railway variables set API_KEY=$(openssl rand -base64 32)

# 5. 部署
railway up

# 6. 获取公网URL
railway open
# 应该看到类似：https://firecrawl-lite-prod.railway.app
```

**记住后端URL：** `https://firecrawl-lite-prod.railway.app`

### 第4步：部署前端到Cloudflare Pages

**方法A：Git自动部署（推荐）**

1. 在GitHub配置中添加仓库
2. 连接到Cloudflare Pages
3. 设置构建参数：
   - Build Command: （留空，前端无需构建）
   - Output Directory: `public`
4. 自动部署

**方法B：使用Wrangler CLI**

```bash
npm install -g wrangler

wrangler pages deploy public \
  --project-name=firecrawl-lite \
  --branch=production
```

**获得前端URL：** `https://firecrawl-lite.pages.dev`

### 第5步：配置反向代理

在Cloudflare上，将 `/api/*` 的请求转发到后端。

**选项A：使用Origin Rules（推荐，简单）**

1. Cloudflare Dashboard → 你的域名
2. Rules → Origin Rules
3. 创建新规则：
   ```
   IF    URI Path 包含 /api
   THEN  转发到 firecrawl-lite-prod.railway.app
   ```

**选项B：使用Workers（更灵活）**

```javascript
// wrangler.toml
name = "firecrawl-proxy"
route = "example.com/api/*"
zone_id = "your_zone_id"

// src/index.ts
export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      
      // 仅处理 /api/* 路径
      if (!url.pathname.startsWith('/api')) {
        return new Response('Not Found', { status: 404 });
      }
      
      const backend = 'https://firecrawl-lite-prod.railway.app';
      const backendUrl = `${backend}${url.pathname}${url.search}`;
      
      // 直接传递body，保留查询参数
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      return await fetch(backendRequest);
      
    } catch (error) {
      return new Response('Backend unavailable', { status: 502 });
    }
  },
};
```

部署：
```bash
wrangler publish
```

**选项C：自建 Caddy/Nginx**

使用 VPS 自建反向代理（与本地开发配置相同）：

```caddyfile
# Caddyfile
example.com {
  route /api* {
    reverse_proxy https://firecrawl-lite-prod.railway.app
  }
  route /* {
    reverse_proxy https://firecrawl-lite.pages.dev
  }
}
```

或 Nginx：
```nginx
server {
  listen 80;
  server_name example.com;

  # 完整转发 /api/* 路径（与 Caddy 行为一致）
  location /api/ {
    proxy_pass https://firecrawl-lite-prod.railway.app/api/;
  }

  location / {
    proxy_pass https://firecrawl-lite.pages.dev;
  }
}
```

### 第6步：验证部署

```bash
# 1. 测试前端
curl https://example.com/
# 应该返回HTML（首页）

# 2. 测试后端健康检查
curl https://example.com/api/health
# 应该返回 { "status": "ok", "timestamp": "..." }

# 3. 测试完整流程
# 在浏览器访问 https://example.com
# 输入URL进行抓取
# 检查批量结果、下载等功能
```

---

## 常见问题

### Q1: 为什么删除了前端静态文件服务？
**A:** 前端现在由Cloudflare Pages托管（CDN加速），后端只负责API逻辑。这样分离更清晰，扩展性更好。

### Q2: 本地开发时怎么测试？
**A:** 三种方式：
1. **Caddy 反向代理**（推荐）：`caddy run --config Caddyfile`，访问 http://localhost:8000
2. **直接访问**：前端 8080 + 后端 3000，在浏览器 console 设置 `window.API_BASE = 'http://localhost:3000/api'`
3. **其他代理**：Nginx、Traefik 等，参考 Caddyfile 配置路由规则

### Q3: 如何修改后端地址？
**A:** 修改Cloudflare的Origin Rules配置，无需重新部署前端。

### Q4: 支持API认证吗？
**A:** 是的，设置 `API_KEY` 环境变量，后端会检查 `Authorization: Bearer` 头。

### Q5: 性能如何？
**A:**
- 前端：通过Cloudflare CDN，全球加速
- 后端：Railway服务器，响应时间取决于爬虫耗时（170ms-5s）
- 中间：Cloudflare边缘计算，毫秒级延迟

---

## 环境变量参考

### 必需的

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `PORT` | 3000 | 服务器端口 |
| `NODE_ENV` | development | 环境（development/production） |

### 可选的

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `API_KEY` | （无） | API认证密钥，留空则无需认证 |
| `MAX_BROWSERS` | 5 | 并发浏览器实例数 |
| `MAX_CRAWL_DEPTH` | 3 | 最大爬虫深度 |
| `MAX_CRAWL_PAGES` | 50 | 最大爬取页数 |
| `LOG_LEVEL` | info | 日志级别 |

---

## 监控和日志

Railway提供实时日志查看：
```bash
railway logs
# 或在Dashboard查看
```

Cloudflare Analytics：
- 请求量
- 缓存命中率
- 源服务器健康状况

---

## 回滚和更新

**更新代码：**
```bash
git push origin main
# Railway自动检测并重新部署
```

**更新前端：**
```bash
git push origin main
# Cloudflare Pages自动检测并重新部署
```

**更新环境变量：**
```bash
railway variables set KEY=value
railway deploy
```

---

## 安全注意事项

✅ **已实施：**
- 前端通过CDN，无法直接访问后端
- API密钥通过环境变量（不在代码中）
- Cloudflare提供DDoS防护

⚠️ **建议：**
- 定期更换API密钥
- 监控异常流量
- 设置合理的速率限制
- 定期备份配置

---

## 故障排查

### 前端无法访问
```
检查步骤：
1. Cloudflare Pages部署是否成功
2. 域名DNS是否指向Cloudflare
3. 访问 https://example.pages.dev （绕过域名）
```

### 后端API无法访问
```
检查步骤：
1. Railway deployment是否运行
2. railway logs 检查错误日志
3. 测试直接访问 https://firecrawl-lite-prod.railway.app/api/health
4. 检查Cloudflare Origin Rules配置
```

### CORS错误
```
同域名部署不应该有CORS错误。
如果有，检查：
1. Cloudflare反向代理是否正确配置
2. 请求头是否被修改
3. 浏览器console的完整错误信息
```

### 浏览器池耗尽（Browser Pool Exhausted）

**症状：**
- 响应时间超过30秒
- 新请求等待时间过长
- 错误率上升

**诊断：**
```bash
# 检查浏览器获取与释放（需要非生产环境日志）
acquired=$(grep -c '"message":"Browser acquired"' app.log)
released=$(grep -c '"message":"Browser released"' app.log)
echo "Acquired: $acquired, Released: $released, Diff: $((acquired - released))"

# 示例输出：
# Acquired: 150, Released: 148, Diff: 2  ← 正常（队列存在但小）
# Acquired: 50, Released: 5, Diff: 45   ← 问题（浏览器未释放）
```

**解决方案：**
1. **如果 acquired >> released** → 浏览器未正确关闭
   - 检查代码中的 `browser.close()` 是否在 finally 块中
   - 这是代码bug，需要修复

2. **如果 acquired ≈ released** → 池确实已满
   - 客户端限制请求速率（2 req/sec）
   - 或增加 `MAX_BROWSERS`（每个浏览器约100MB内存）
   ```bash
   railway variables set MAX_BROWSERS=8
   ```

3. **立即缓解：**
   - 客户端禁用 `autoClickTabs`（节省3-5秒）

### 内存持续增长

**症状：**
- RSS内存持续增长
- 最终OOM崩溃
- 重启后恢复

**诊断：**
```bash
# 实时监控内存
watch -n 1 'ps aux | grep node'

# 检查浏览器释放日志
tail -f app.log | grep 'Browser released' | wc -l
# 计数应该持续增加
```

**解决方案：**
1. 验证浏览器清理（检查 `browser.close()` 在 finally 块中）
2. 限制爬虫范围：
   ```bash
   railway variables set MAX_CRAWL_PAGES=50
   ```
3. 临时方案：每日重启
   ```bash
   # Cron job
   0 3 * * * systemctl restart firecrawl
   ```

### 频繁超时

**症状：**
- 多个请求超时
- 错误率 > 5%

**诊断：**
```bash
# 检查哪些域名超时
grep 'Timeout' app.log | jq -r '.url' 2>/dev/null | sort | uniq -c

# 示例输出：
#  3 https://slow-api.example.com/docs ← 同一域名反复超时
#  1 https://github.com/user/repo
# → 解释：slow-api 是网站问题

# 检查浏览器池状态
acquired=$(grep -c 'Browser acquired' app.log)
released=$(grep -c 'Browser released' app.log)
echo "Acquired: $acquired, Released: $released"
```

**解决方案：**
1. **如果特定域名超时** → 网站慢或阻止
   - 增加该URL的超时时间（60000ms）
   - 或接受无法抓取

2. **如果随机域名超时** → 服务器过载
   - 参考"浏览器池耗尽"解决方案
   - 减少客户端并发

3. **如果偶尔超时（1次/分钟）** → 正常，忽略

### 网站返回 403/429

**症状：**
- 特定网站返回 403 Forbidden 或 429 Too Many Requests
- 其他网站正常

**诊断：**
```bash
# 手动测试
curl -I https://example.com
# 如果返回403：网站阻止请求

# 检查User-Agent
curl -I -A 'Mozilla/5.0' https://example.com
# 如果这个正常：User-Agent被识别为bot
```

**解决方案：**
1. 降低请求频率（客户端限速：1请求/2秒）
2. 接受限制：某些网站无法抓取（设计如此）
   - 新闻站、支付页、需要登录的内容

### 爬虫未完成所有页面

**症状：**
- 爬虫提前停止
- 页面数少于预期

**诊断：**
```bash
# 检查日志
tail -f app.log | grep 'Max'
# 查找 "Max depth reached" 或 "Max pages reached"
```

**解决方案：**
1. 增加限制：
   ```bash
   railway variables set MAX_CRAWL_DEPTH=4
   railway variables set MAX_CRAWL_PAGES=100
   ```

2. 启用JS渲染（如果链接是动态生成）：
   ```json
   {
     "renderJS": true,
     "autoClickTabs": true
   }
   ```

3. 接受限制：网站结构可能不支持爬虫

### 响应延迟高

**症状：**
- 请求耗时30+秒
- p95延迟 > 10秒

**解决方案：**
1. 禁用 `autoClickTabs`（除非内容在隐藏标签）
2. 对静态网站使用 `renderJS: false`（快170ms vs 5s）
3. 如果池饱和，参考"浏览器池耗尽"

---

## 成本估算

| 服务 | 成本 | 说明 |
|------|------|------|
| Cloudflare Pages | 免费 | 无限带宽和请求 |
| Cloudflare Workers | $0~$5/月 | 免费：10万请求/天，超出$0.50/百万请求 |
| Railway | $5~$20/月 | 1GB内存起（Puppeteer要求），免费512MB不够 |
| 域名 | $10-15/年 | 可选，使用pages.dev免费域名 |
| **总计** | **$5~$30/月** | Puppeteer内存密集，不推荐免费套餐 |

**注意：**
- Railway免费套餐：512MB内存，**不足以运行默认配置**（需600+MB）
- 推荐最低配置：1GB内存，$5/月起
- 如需降低成本，设置 `MAX_BROWSERS=2`，但性能会下降
- Cloudflare Workers: 日均请求 < 10万则完全免费

---

## 后续改进

- [ ] 添加数据库（PostgreSQL）保存爬虫结果
- [ ] 实现用户认证和历史记录
- [ ] 添加爬虫任务队列和调度
- [ ] 性能监控和告警
- [ ] 多语言支持
- [ ] 移动端优化

---

**部署完毕后，你的应用将在世界各地以极速运行！** 🚀
