# Firecrawl Lite - 项目开发指导

## 核心哲学

> "Do one thing well. Keep it simple. Talk is cheap, show me the code." — Linus Torvalds

这是一个 **3000 行的小项目**，不要过度工程。

---

## 文档结构（单一真实来源）

| 文档 | 职责 | 何时更新 |
|------|------|----------|
| **README.md** | 快速入门 + API 概览 | 改 API、改启动流程、改配置 |
| **DEPLOYMENT.md** | 详细部署指南 | 改部署方式、改架构 |
| **public/README.md** | 前端文件说明 | 改前端文件结构 |
| **.env.example** | 配置示例值 | 新增/修改环境变量 |

**规则**：
- 链接而非复制（避免不一致）
- 最小重复（一个真相只写一次）

---

## 开发流程

### 1. 改代码前

```bash
# 确保环境干净
git status
npm test
```

### 2. 改代码

- 遵循现有模式
- 添加测试（如果是新功能）
- 保持简单

### 3. 改代码后（重要）

**文档同步检查清单**：

- [ ] 改了 API？更新 README.md 的示例
- [ ] 改了路由？`grep -r '旧路径' public/` 检查前端
- [ ] 改了配置？更新 .env.example
- [ ] 改了启动流程？同步三个 README

**运行测试**：
```bash
npm test
```

### 4. 提交前

```bash
# 1. 暂存改动
git add .

# 2. 代码审查（必须）
# 调用 code-reviewer Agent

# 3. 提交（pre-commit hook 会自动检查）
git commit -m "描述改动"
```

---

## API 设计规范

**端点命名**：
- `/api/scrape` - 单页抓取
- `/api/crawl` - 递归爬取
- `/api/health` - 健康检查

**请求格式**：
```json
{
  "url": "https://example.com",
  "renderJS": false,
  "autoClickTabs": false
}
```

**错误处理**：
- 4xx - 客户端错误（参数错误、URL 无效）
- 5xx - 服务器错误（超时、网络问题）

---

## 测试策略

**何时写测试**：
- 新增函数 → 单元测试
- 新增 API → 集成测试
- 修 Bug → 回归测试

**测试位置**：
- `tests/unit/` - 快速、隔离的单元测试
- `tests/integration/` - 真实网络的集成测试

**运行测试**：
```bash
npm test                    # 单元测试
npm run test:integration    # 集成测试
npm run test:all            # 全部测试
```

---

## 不要做的事（避免过度工程）

❌ **不要引入复杂框架** - 保持依赖最小
❌ **不要过早优化** - 先让它能用，再让它快
❌ **不要复制粘贴代码** - DRY 原则
❌ **不要忘记更新文档** - pre-commit hook 会提醒你

---

## Git Hooks 分工

**Husky Pre-commit Hook（强制）**：
1. 文档同步提醒（非阻塞）
2. 运行测试
3. 检查代码审查（`.approved-commit`）

**Husky Post-commit Hook**：
- 清理 `.approved-commit`

**Codebuddy Code-reviewer Agent（人工触发）**：
- 深度代码审查
- 创建 `.approved-commit` 凭证

---

## 常见问题

### Q: 文档太多了，不想同步怎么办？
A: 那就别改 API 和配置。如果改了，必须同步，否则 pre-commit hook 会提醒你。

### Q: 测试太慢，能跳过吗？
A: 不能。pre-commit hook 会运行测试。如果嫌慢，说明测试写得不好。

### Q: 我就想快速提交，不想代码审查怎么办？
A: 不行。没有 `.approved-commit` 文件，`git commit` 会失败。这是机制，不是建议。

---

**记住：这是个 3000 行的小项目，保持简单。**

