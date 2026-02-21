# Stock-SimGame v2.0 前端 × v1.5 后端 集成测试计划

> **创建时间**: 2026-02-20 10:28  
> **测试目标**: 验证前端 v2.0 (Next.js 14) 与后端 v1.5.0 (Node.js) 的完整功能集成  
> **测试环境**: https://gamestock.artfox.ltd

---

## 🧪 测试范围

### 1. 认证模块 (Auth)
| 测试项 | 接口 | 预期结果 |
|--------|------|----------|
| 用户注册 | POST /api/auth/register | 返回用户 ID 和默认余额 $100,000 |
| 用户登录 | POST /api/auth/login | 返回 accessToken 和 refreshToken |
| Token 验证 | GET /api/account (with Bearer token) | 返回用户账户信息 |
| 登出 | localStorage 清除 | Token 失效，跳转登录页 |

### 2. 交易模块 (Trading)
| 测试项 | 接口 | 预期结果 |
|--------|------|----------|
| 市价买入 | POST /api/orders (MARKET, BUY) | 订单立即成交，持仓更新 |
| 市价卖出 | POST /api/orders (MARKET, SELL) | 订单立即成交，持仓减少 |
| 限价买入 | POST /api/orders (LIMIT, BUY) | 订单进入挂单簿 |
| 限价卖出 | POST /api/orders (LIMIT, SELL) | 订单进入挂单簿 |
| 订单查询 | GET /api/orders | 返回订单列表 |
| 持仓查询 | GET /api/positions | 返回持仓列表 |

### 3. 行情模块 (Market)
| 测试项 | 接口 | 预期结果 |
|--------|------|----------|
| 价格查询 | GET /api/market/prices | 返回所有股票价格 |
| K线数据 | GET /api/kline/:symbol | 返回 K 线数据 |
| 订单簿 | GET /api/market/orderbook/:symbol | 返回买卖盘 |
| WebSocket 连接 | wss://gamestock.artfox.ltd/ws | 实时推送价格 |

### 4. 游戏化模块 (Gamification)
| 测试项 | 接口 | 预期结果 |
|--------|------|----------|
| 任务列表 | GET /api/tasks | 返回任务和进度 |
| 成就列表 | GET /api/achievements | 返回成就和解锁状态 |
| 排行榜 | GET /api/leaderboard/:type | 返回排名数据 |
| 领取奖励 | POST /api/tasks/:id/claim | 奖励发放成功 |

### 5. 社交模块 (Social)
| 测试项 | 接口 | 预期结果 |
|--------|------|----------|
| 动态列表 | GET /api/feed | 返回动态列表 |
| 发帖 | POST /api/feed | 创建成功 |
| 点赞 | POST /api/feed/:id/like | 点赞成功 |
| 关注 | POST /api/follow/:userId | 关注成功 |

---

## 📋 测试执行清单

- [ ] 1. 认证流程测试
- [ ] 2. 交易流程测试（市价单）
- [ ] 3. 交易流程测试（限价单）
- [ ] 4. WebSocket 实时行情测试
- [ ] 5. 游戏化系统测试
- [ ] 6. 社交功能测试
- [ ] 7. 数据类型兼容性测试
- [ ] 8. 错误处理测试

---

## 🐛 已知问题 & 修复记录

| 问题 | 原因 | 状态 | 修复时间 |
|------|------|------|----------|
| `toFixed is not a function` | 后端返回字符串类型数值 | ✅ 已修复 | 2026-02-20 |
| `e.filter is not a function` | API 返回对象而非数组 | ✅ 已修复 | 2026-02-20 |
| `/assets/sounds/*.mp3` 404 | 音效文件缺失 | ✅ 已修复(静默模式) | 2026-02-20 |
| SSR Hydration 错误 | localStorage 在 SSR 不可用 | ✅ 已修复 | 2026-02-20 |

---

## 📊 测试报告

*执行后自动生成*
