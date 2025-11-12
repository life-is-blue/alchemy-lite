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

**Single-Container Architecture (via .cnb.yml):**

```
User → https://izoa.fun (HTTPS with auto SSL)
  ↓
Docker Container (firecrawl-lite)
  ├─ Caddy Reverse Proxy (ports 80 + 443)
  │   ├─ Auto SSL via Let's Encrypt
  │   ├─ HTTP → HTTPS redirect
  │   ├─ /api/* → Backend (localhost:3000)
  │   └─ /*     → Frontend (/app/public)
  └─ Node.js Backend (localhost:3000)
```

**Everything runs in a single container with dual-process architecture.**

**Philosophy:**
- Single-command deployment: `git tag v1.0.0 && git push --tags`
- Self-contained: Frontend, backend, and proxy in one image
- Auto HTTPS: Caddy handles SSL certificates automatically
- Zero downtime rollback: Replace entire container atomically

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

**Prerequisites:**

1. **DNS Configuration**
   ```bash
   # Set A record for your domain
   izoa.fun → <Your-VPS-IP>
   
   # Verify DNS propagation
   dig izoa.fun +short
   # Should return your VPS IP
   ```

2. **Firewall Configuration**
   ```bash
   # Ubuntu/Debian (ufw)
   sudo ufw allow 80/tcp   # HTTP + ACME verification
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw reload
   
   # CentOS/RHEL (firewalld)
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   
   # Cloud provider security groups
   # Make sure ports 80 and 443 are open in your cloud console
   ```

**Deployment Process:**

```bash
# 1. Create a release tag
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
# 1. Create persistent volume for SSL certificates
mkdir -p /opt/firecrawl-lite/caddy-data

# 2. Pull image from registry
docker pull docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:v1.0.0

# 3. Stop old container (if exists)
docker stop firecrawl-lite
docker rm firecrawl-lite

# 4. Start single container with dual-process architecture
docker run -d \
  -p 80:80 \      # HTTP + ACME challenge
  -p 443:443 \    # HTTPS
  --name firecrawl-lite \
  --restart=always \
  -v /opt/firecrawl-lite/caddy-data:/data \  # Persistent SSL cert storage
  -e VERSION="v1.0.0" \
  docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:v1.0.0

# 5. Caddy automatically obtains Let's Encrypt certificate
# First deployment: may take 10-15 seconds
# Subsequent deployments: uses cached certificate
```

**Access:**
- Frontend: `https://izoa.fun/`
- API: `https://izoa.fun/api/health`
- HTTP: `http://izoa.fun/` (auto-redirects to HTTPS)

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

### Step 4: Verify Deployment

**Check container status:**
```bash
# 1. Check if container is running
docker ps | grep firecrawl-lite

# Should show 1 container:
# CONTAINER ID   IMAGE                                              PORTS                        NAMES
# abc123...      docker.cnb.cool/.../firecrawl-lite:v1.0.0         0.0.0.0:80->80, 443->443     firecrawl-lite
```

**Check SSL certificate:**
```bash
# 2. Check certificate provisioning logs
docker logs firecrawl-lite | grep -i certificate

# Should see lines like:
# [INFO] certificate obtained successfully
# [INFO] Serving HTTPS on https://izoa.fun
```

**Test HTTPS endpoints:**
```bash
# 3. Test HTTPS health check
curl https://izoa.fun/api/health
# Should return: {"status":"ok","timestamp":"...","version":"v1.0.0"}

# 4. Verify SSL certificate
curl -vI https://izoa.fun 2>&1 | grep -i "issuer"
# Should show: issuer: C=US; O=Let's Encrypt; CN=...

# 5. Test HTTP redirect
curl -I http://izoa.fun
# Should return: HTTP/1.1 308 Permanent Redirect
#                Location: https://izoa.fun/

# 6. Test frontend
curl https://izoa.fun/
# Should return HTML (homepage with <!DOCTYPE html>...)
```

**Test in browser:**
```bash
# Visit https://izoa.fun in browser
# - Should show green lock icon (valid SSL)
# - Enter a URL to scrape
# - Check batch results, downloads, etc.
```

---

## FAQ

### Q1: How does HTTPS work automatically?
**A:** Caddy handles everything:
- Detects the domain name (`izoa.fun`) in Caddyfile
- Automatically requests certificate from Let's Encrypt
- Renews certificates before expiration (90-day cycle)
- Redirects HTTP to HTTPS automatically

### Q2: What if SSL certificate fails to provision?
**A:** Check these common issues:
```bash
# 1. DNS not pointing to server
dig izoa.fun +short  # Should return your VPS IP

# 2. Ports not accessible
nc -zv <server-ip> 80
nc -zv <server-ip> 443

# 3. Check Caddy logs for errors
docker logs firecrawl-lite 2>&1 | grep -i "acme\|error\|certificate"
```

### Q3: Can I use a different domain?
**A:** Yes. Modify `Caddyfile.prod`:
```caddyfile
your-domain.com {  # Change this line
  reverse_proxy /api/* localhost:3000
  root * /app/public
  file_server
  encode gzip
}
```
Then rebuild and redeploy the image.

### Q4: How do I rollback to a previous version?
**A:** Trigger manual `rollback` operation in CI with `ROLLBACK_VERSION=v1.0.0`. This replaces the entire container with the old version. SSL certificates are preserved in `/opt/firecrawl-lite/caddy-data`.

### Q5: Why single container instead of separate frontend/backend?
**A:** Simplicity and reliability:
- Fewer moving parts (1 container vs 3)
- No Docker network configuration needed
- Frontend is only 272KB, minimal overhead
- Atomic deployments (replace everything at once)
- Easier debugging (single container to inspect)

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
# Entire container is replaced atomically
# SSL certificates are preserved in /opt/firecrawl-lite/caddy-data
```

**Update environment variables:**
```bash
# SSH to server
docker stop firecrawl-lite
docker rm firecrawl-lite
docker run -d \
  -p 80:80 \
  -p 443:443 \
  --name firecrawl-lite \
  --restart=always \
  -v /opt/firecrawl-lite/caddy-data:/data \
  -e VERSION="v1.0.0" \
  -e NEW_VAR="value" \
  docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:v1.0.0
```

---

## Security

✅ **Implemented:**
- Single-container architecture (reduced attack surface)
- Auto HTTPS via Let's Encrypt (SSL certificates)
- API keys via environment variables (not in code)
- Container runs as non-root user (nodejs:nodejs)

⚠️ **Recommendations:**
- Backend port 3000 not exposed (internal only, proxied by Caddy)
- Caddy handles all external traffic on 80/443
- Rotate API keys periodically
- Monitor unusual traffic patterns
- Set rate limits in Caddyfile if needed

---

## Troubleshooting

### Container not starting
```bash
# Check container status
docker ps -a | grep firecrawl-lite

# If exited, check logs
docker logs firecrawl-lite

# Common issues:
# - Port already in use (80 or 443)
# - Permission denied on /opt/firecrawl-lite/caddy-data
```

### Backend not responding
```bash
# Check if backend process is running inside container
docker exec firecrawl-lite ps aux | grep node

# Should show: node /app/dist/index.js

# Test backend directly
docker exec firecrawl-lite curl -sf http://localhost:3000/api/health

# If fails, check backend logs
docker logs firecrawl-lite | grep -v "caddy"
```

### Caddy not routing correctly
```bash
# Check Caddy logs
docker logs firecrawl-lite | grep -i caddy

# Verify Caddyfile inside container
docker exec firecrawl-lite cat /etc/caddy/Caddyfile

# Test routing manually
docker exec firecrawl-lite curl -v http://localhost:80/api/health
docker exec firecrawl-lite curl -v http://localhost:80/
```

### SSL certificate issues
```bash
# Check certificate status
docker logs firecrawl-lite | grep -i "certificate\|acme"

# Verify certificate files exist
docker exec firecrawl-lite ls -la /data/caddy/certificates/

# Force certificate renewal (if expired)
docker exec firecrawl-lite caddy reload --config /etc/caddy/Caddyfile
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

**Self-hosted VPS (Recommended):**

| Item | Cost | Notes |
|------|------|-------|
| VPS (1GB RAM) | $5-10/month | DigitalOcean, Linode, Vultr |
| VPS (2GB RAM) | $10-20/month | Recommended for Puppeteer |
| Domain (izoa.fun) | $10-15/year | Already owned |
| SSL Certificate | **Free** | Let's Encrypt via Caddy |
| **Total** | **$5-20/month** | Puppeteer requires at least 1GB RAM |

**Managed Platform (Railway/Render):**

| Item | Cost | Notes |
|------|------|-------|
| Railway (1GB RAM) | $5-10/month | Auto-scaling |
| Render (1GB RAM) | $7/month | Fixed price |
| Domain | $10-15/year | Already owned |
| SSL Certificate | **Free** | Included |
| **Total** | **$5-15/month** | Easier to manage, less control |

**Notes:**
- **Single-container architecture saves $0** but reduces complexity
- Free tier VPS (512MB) not recommended - Puppeteer needs 600MB+
- Reduce cost: Set `MAX_BROWSERS=2` (trades performance for memory)
- SSL is free with Let's Encrypt (auto-renewal via Caddy)

---

## Architecture Diagram

```
Internet
   ↓
DNS (izoa.fun)
   ↓
Ports 80 (HTTP) + 443 (HTTPS)
   ↓
┌─────────────────────────────────────────────────┐
│  Docker Container: firecrawl-lite               │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Caddy (PID 1, managed by tini)            │ │
│  │ - Auto SSL via Let's Encrypt              │ │
│  │ - HTTP → HTTPS redirect                   │ │
│  │ - Reverse proxy:                          │ │
│  │   • /api/* → localhost:3000               │ │
│  │   • /*     → /app/public (static files)   │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                             │
│                  ↓                             │
│  ┌───────────────────────────────────────────┐ │
│  │ Node.js Backend (background process)     │ │
│  │ - Port 3000 (internal only)               │ │
│  │ - Puppeteer + Cheerio scraping            │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Volumes:                                       │
│  - /opt/firecrawl-lite/caddy-data → /data (SSL certificates)   │
└─────────────────────────────────────────────────┘
```

**Deployment is complete when you see:**
```
==> ✓ Deployment complete
==> Container status:
CONTAINER ID   IMAGE                                    PORTS                   NAMES
abc123...      ...firecrawl-lite:v1.0.0                0.0.0.0:80->80, 443->443 firecrawl-lite

==> Access your app at:
    https://izoa.fun/ (HTTPS - recommended)
    http://izoa.fun/  (HTTP - redirects to HTTPS)
```

**Process tree inside container:**
```
PID 1:  tini
  └─ PID 2:  /app/docker-entrypoint.sh
       ├─ PID 3:  node /app/dist/index.js (background)
       └─ PID 4:  caddy run (foreground)
```
