# 服务边界定义

## 1. 服务职责矩阵

### 1.1 Auth Service (认证服务)

| 功能 | API | 依赖 |
|------|-----|------|
| 用户注册 | POST /auth/register | - |
| 用户登录 | POST /auth/login | - |
| Token刷新 | POST /auth/refresh | - |
| 权限验证 | POST /auth/verify | - |
| 登出 | POST /auth/logout | Redis (黑名单) |

**数据所有权**:
- users 表 (用户凭证)
- sessions 表 (会话管理)
- roles 表 (角色定义)

**不负责**:
- 用户持仓数据 → Game Service
- 交易历史 → Trading Service

---

### 1.2 Trading Service (交易服务)

| 功能 | API | 依赖 |
|------|-----|------|
| 下单 | POST /orders | Market (价格验证) |
| 撤单 | DELETE /orders/:id | - |
| 订单查询 | GET /orders | Game (持仓验证) |
| 撮合引擎 | 内部服务 | Market (实时价格) |

**数据所有权**:
- orders 表 (订单记录)
- trades 表 (成交记录)
- order_book 表 (订单簿快照)

**不负责**:
- 用户持仓更新 → 通过事件通知 Game Service
- 行情数据 → Market Service

---

### 1.3 Market Service (行情服务)

| 功能 | API | 依赖 |
|------|-----|------|
| 实时行情 | GET /quotes/:symbol | - |
| K线数据 | GET /klines/:symbol | - |
| 价格历史 | GET /history/:symbol | - |
| 订阅推送 | WebSocket /ws/market | - |

**数据所有权**:
- quotes 表 (实时行情)
- klines 表 (K线数据)
- ticks 表 (Tick数据)

**不负责**:
- 交易执行 → Trading Service
- 用户资产 → Game Service

---

### 1.4 Game Service (游戏服务)

| 功能 | API | 依赖 |
|------|-----|------|
| 用户信息 | GET /users/:id | Auth (验证) |
| 持仓查询 | GET /holdings | - |
| 盈亏分析 | GET /pnl/analysis | Market (价格) |
| 排行榜 | GET /leaderboard | - |
| 统计数据 | GET /stats | - |

**数据所有权**:
- user_profiles 表 (用户资料)
- holdings 表 (持仓)
- achievements 表 (成就)
- stats 表 (统计)

**不负责**:
- 认证 → Auth Service
- 交易 → Trading Service

---

## 2. 服务交互边界

### 2.1 允许的跨服务调用

```
Trading Service → Market Service (获取实时价格)
Trading Service → Game Service (验证持仓)
Game Service → Market Service (计算盈亏)
Game Service → Auth Service (验证用户)
API Gateway → All Services (路由)
```

### 2.2 禁止的跨服务调用

```
Market Service → Trading Service ❌ (避免循环依赖)
Market Service → Game Service ❌ (行情独立)
Auth Service → Trading Service ❌ (认证独立)
Auth Service → Market Service ❌ (认证独立)
```

---

## 3. 耦合度评估

| 服务对 | 耦合类型 | 级别 | 说明 |
|--------|----------|------|------|
| Auth - Game | 数据依赖 | 低 | 仅Token验证 |
| Trading - Market | 数据依赖 | 中 | 需实时价格 |
| Trading - Game | 事件依赖 | 高 | 成交需更新持仓 |
| Game - Market | 数据依赖 | 中 | 计算盈亏需价格 |

---

## 4. 解耦策略

### 4.1 事件驱动解耦
- Trading 成交后发布 `trade.executed` 事件
- Game 订阅并异步更新持仓
- 避免同步调用链过长

### 4.2 数据冗余
- Game 缓存最新价格 (TTL 5s)
- 减少对 Market 的实时依赖

### 4.3 API 版本化
- 所有服务 API 带 /v1/ 前缀
- 便于独立升级
