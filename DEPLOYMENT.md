# Firecrawl Lite - Deployment Guide

## Local Development

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

## Production Deployment

### Architecture

**Automated Deployment (via .cnb.yml):**

```
User → http://server-ip:80
  ↓
Caddy Reverse Proxy (Docker container, port 80)
  ├─ /         → Frontend (Nginx container, internal port 80)
  └─ /api/*    → Backend (Node.js container, internal port 3000)
```

**All 3 containers run on the same server, connected via Docker network.**

**Philosophy:**
- Single-command deployment: `git tag v1.0.0 && git push --tags`
- Self-contained: No external dependencies (Cloudflare Pages, etc.)
- Rollback-friendly: Backend-only rollback preserves frontend

---

## Deployment Steps

### Step 1: Code Changes (Already Done)

Frontend and backend are configured for separation:

**Frontend:**
- `public/app.js`: Uses `Config.API_BASE` for API calls
- `public/config.js`: Health check points to `/api/health`

**Backend:**
- Removed `express.static('public')` - Static files served separately
- API routes use `/api` prefix:
  - `/health` → `/api/health`
  - `/scrape` → `/api/scrape`
  - `/crawl` → `/api/crawl`

### Step 2: Local Testing

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

### Step 3: Automated Production Deployment

**Architecture deployed by `.cnb.yml`:**

1. **Backend Container** (`firecrawl-lite-backend`)
   - Runs Node.js app from Docker image
   - Internal network only (no exposed ports)
   - Connected to `firecrawl-network`

2. **Frontend Container** (`firecrawl-lite-frontend`)
   - Nginx serving `public/` directory
   - Files fetched from GitHub release tag
   - Internal network only

3. **Reverse Proxy** (`firecrawl-lite-proxy`)
   - Caddy routes traffic:
     - `/api/*` → Backend container
     - `/*` → Frontend container
   - Exposes port 80 to internet

**Deployment process:**

```bash
# 1. Create a release
git tag v1.0.0
git push origin v1.0.0

# 2. CI builds Docker image automatically
# (see .cnb.yml tag_push workflow)

# 3. Manually trigger deployment in CI
# Set environment variable: DEPLOY_VERSION=v1.0.0
# Run manual operation: deploy
```

**What happens on the server:**
```bash
# Pulls image from registry
docker pull docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:v1.0.0

# Creates Docker network (if not exists)
docker network create firecrawl-network

# Starts 3 containers:
# - Backend (no exposed ports)
# - Frontend (Nginx with public/ files)
# - Caddy (port 80, routes traffic)
```

**Access:**
- Frontend: `http://server-ip/`
- API: `http://server-ip/api/health`

---

### Step 4 (Alternative): Manual Deployment to Railway

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

---

### Step 5: Verify Deployment

```bash
# 1. Test frontend
curl http://server-ip/
# Should return HTML (homepage)

# 2. Test backend health check
curl http://server-ip/api/health
# Should return { "status": "ok", "timestamp": "..." }

# 3. Test full workflow
# Visit http://server-ip in browser
# Enter a URL to scrape
# Check batch results, downloads, etc.
```

**Check running containers:**
```bash
docker ps | grep firecrawl-lite

# Should show 3 containers:
# firecrawl-lite-backend
# firecrawl-lite-frontend
# firecrawl-lite-proxy
```

---

## FAQ

### Q1: Why are frontend and backend separated?
**A:** Clear separation of concerns. Backend handles scraping logic, frontend handles UI. Each can scale independently.

### Q2: Can I use a custom domain?
**A:** Yes. Point your domain's A record to the server IP. Caddy will serve on port 80 (or configure SSL with Caddy's automatic HTTPS).

### Q3: How do I enable HTTPS?
**A:** Modify the Caddyfile in deployment script:
```caddyfile
example.com {  # Replace :80 with your domain
  route /api* {
    reverse_proxy firecrawl-lite-backend:3000
  }
  route /* {
    reverse_proxy firecrawl-lite-frontend:80
  }
}
```
Caddy automatically provisions Let's Encrypt certificates.

### Q4: How do I rollback?
**A:** Trigger manual `rollback` operation in CI with `ROLLBACK_VERSION=v1.0.0`. This only restarts the backend container with the old version, keeping frontend and proxy unchanged.

### Q5: Can I deploy to Cloudflare Pages instead?
**A:** Yes, but you'll need to:
1. Deploy `public/` to Cloudflare Pages manually
2. Deploy backend to Railway/VPS
3. Configure Cloudflare Workers or Origin Rules to route `/api/*` to backend
(This approach is documented separately in DEPLOYMENT.md Step 4)

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

## Updates and Rollbacks

**Update code:**
```bash
# Create new version tag
git tag v1.0.1
git push origin v1.0.1

# CI builds new image automatically
# Manually trigger 'deploy' operation with DEPLOY_VERSION=v1.0.1
```

**Rollback to previous version:**
```bash
# Trigger 'rollback' operation with ROLLBACK_VERSION=v1.0.0
# Only backend is replaced, frontend and proxy remain unchanged
```

**Update environment variables:**
```bash
# SSH to server
docker stop firecrawl-lite-backend
docker rm firecrawl-lite-backend
docker run -d \
  --name firecrawl-lite-backend \
  --network firecrawl-network \
  --restart=always \
  -e VERSION="v1.0.0" \
  -e NEW_VAR="value" \
  docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:v1.0.0
```

---

## Security

✅ **Implemented:**
- Backend and frontend isolated via Docker network
- API keys via environment variables (not in code)
- Containers run as non-root user

⚠️ **Recommendations:**
- Use firewall to block direct access to ports 3000, 8080
- Enable HTTPS with Caddy + Let's Encrypt
- Rotate API keys periodically
- Monitor unusual traffic patterns
- Set rate limits in Caddy configuration

---

## Troubleshooting

### Frontend not accessible
```bash
# Check if containers are running
docker ps | grep firecrawl-lite

# Check frontend logs
docker logs firecrawl-lite-frontend

# Test direct access (should work if proxy is down)
curl http://localhost:8080
```

### Backend API not accessible
```bash
# Check backend logs
docker logs firecrawl-lite-backend

# Test direct backend access
docker exec firecrawl-lite-backend wget -O- http://localhost:3000/api/health

# Check if backend is in network
docker network inspect firecrawl-network
```

### Proxy not routing correctly
```bash
# Check Caddy logs
docker logs firecrawl-lite-proxy

# Verify Caddyfile syntax
cat /tmp/Caddyfile

# Test proxy manually
curl -v http://localhost/api/health
```

### Containers not communicating
```bash
# Verify Docker network
docker network inspect firecrawl-network

# Should show all 3 containers in the network

# Recreate network if needed
docker network rm firecrawl-network
docker network create firecrawl-network

# Restart containers to rejoin network
docker restart firecrawl-lite-backend firecrawl-lite-frontend firecrawl-lite-proxy
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

## Cost Estimation

**Self-hosted VPS:**

| Item | Cost | Notes |
|------|------|-------|
| VPS (1GB RAM) | $5-10/month | DigitalOcean, Linode, Vultr |
| VPS (2GB RAM) | $10-20/month | Recommended for Puppeteer |
| Domain | $10-15/year | Optional, can use IP address |
| **Total** | **$5-20/month** | Puppeteer requires at least 1GB RAM |

**Managed Platform (Railway/Render):**

| Item | Cost | Notes |
|------|------|-------|
| Railway (1GB RAM) | $5-10/month | Auto-scaling |
| Render (1GB RAM) | $7/month | Fixed price |
| Domain | $10-15/year | Optional |
| **Total** | **$5-15/month** | Easier to manage, less control |

**Hybrid (Cloudflare + VPS):**

| Item | Cost | Notes |
|------|------|-------|
| Cloudflare Pages | Free | Unlimited bandwidth |
| Cloudflare Workers | $0-5/month | 100k req/day free |
| VPS for backend | $5-10/month | 1GB RAM minimum |
| **Total** | **$5-15/month** | Best performance, CDN included |

**Notes:**
- Free tier VPS (512MB) not recommended - Puppeteer needs 600MB+
- Reduce cost: Set `MAX_BROWSERS=2` (trades performance for memory)
- Self-hosted gives full control but requires more setup

---

## Architecture Diagram

```
Internet
   ↓
Port 80 (Public)
   ↓
┌─────────────────────────────────────────────┐
│ Caddy Reverse Proxy (firecrawl-lite-proxy) │
│ - Routes /api/* to backend                  │
│ - Routes /* to frontend                     │
└─────────────┬───────────────────────────────┘
              │
      Docker Network (firecrawl-network)
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
┌─────────┐      ┌──────────────┐
│ Backend │      │   Frontend   │
│ Node.js │      │    Nginx     │
│ Port    │      │  Serves      │
│ 3000    │      │  public/     │
│ (API)   │      │  Port 80     │
└─────────┘      └──────────────┘
```

**Deployment is complete when you see:**
```
==> Backend:  http://localhost:3000/api/health
==> Frontend: http://localhost:8080
==> Proxy:    http://localhost:80
```

**Access your app at:** `http://server-ip/`
