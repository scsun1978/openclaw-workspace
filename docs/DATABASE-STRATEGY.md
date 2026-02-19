# 数据库拆分策略

## 1. 数据库拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                      Database Per Service                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   auth_db    │  │  trading_db  │  │  market_db   │       │
│  │  PostgreSQL  │  │  PostgreSQL  │  │ TimescaleDB  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐                                           │
│  │   game_db    │                                           │
│  │  PostgreSQL  │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 数据库Schema

### 2.1 auth_db

```sql
-- 用户凭证
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 会话
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_hash VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 角色
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE,
  permissions JSONB
);
```

### 2.2 trading_db

```sql
-- 订单
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,  -- 外部引用 game_db
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) CHECK (side IN ('BUY', 'SELL')),
  type VARCHAR(10) CHECK (type IN ('MARKET', 'LIMIT')),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'PENDING',
  filled_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- 成交
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  symbol VARCHAR(10),
  quantity INTEGER,
  price DECIMAL(10,2),
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 market_db (TimescaleDB)

```sql
-- 实时行情
CREATE TABLE quotes (
  symbol VARCHAR(10),
  price DECIMAL(10,2),
  bid DECIMAL(10,2),
  ask DECIMAL(10,2),
  volume BIGINT,
  time TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_hypertable('quotes', 'time');

-- K线数据
CREATE TABLE klines (
  symbol VARCHAR(10),
  time_bucket TIMESTAMPTZ,
  open DECIMAL(10,2),
  high DECIMAL(10,2),
  low DECIMAL(10,2),
  close DECIMAL(10,2),
  volume BIGINT,
  interval VARCHAR(10)
);
SELECT create_hypertable('klines', 'time_bucket');

-- Tick数据
CREATE TABLE ticks (
  symbol VARCHAR(10),
  price DECIMAL(10,2),
  quantity INTEGER,
  time TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_hypertable('ticks', 'time');
```

### 2.4 game_db

```sql
-- 用户资料
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  username VARCHAR(50),
  balance DECIMAL(15,2) DEFAULT 1000000.00,
  total_asset DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 持仓
CREATE TABLE holdings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  symbol VARCHAR(10),
  quantity INTEGER,
  avg_price DECIMAL(10,2),
  updated_at TIMESTAMP
);

-- 统计
CREATE TABLE stats (
  user_id UUID PRIMARY KEY,
  total_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  total_pnl DECIMAL(15,2),
  max_drawdown DECIMAL(5,2)
);
```

---

## 3. 跨服务数据同步

### 3.1 问题域

| 场景 | 数据源 | 数据目标 | 一致性要求 |
|------|--------|----------|------------|
| 交易更新持仓 | trading_db.orders | game_db.holdings | 最终一致 |
| 用户注册 | auth_db.users | game_db.user_profiles | 强一致 |
| 价格计算盈亏 | market_db.quotes | game_db (计算) | 最终一致 |

### 3.2 同步策略

#### 策略A: 事件驱动 (推荐)

```
Trading Service                    Game Service
      │                                 │
      │  1. 成交写入 orders             │
      │                                 │
      │  2. 发布 trade.executed ─────────►
      │                                 │
      │                                 │ 3. 更新 holdings
      │                                 │
      │                                 │ 4. 确认消费
      │◄────────────────────────────────│
      │                                 │
```

**优点**: 解耦、可扩展、容错
**缺点**: 最终一致性延迟 (1-5s)

#### 策略B: 分布式事务 (不推荐)

```
Trading Service                    Game Service
      │                                 │
      │  1. 开始事务                    │
      │                                 │
      │  2. 写入 orders ────────────────►│
      │                                 │ 3. 更新 holdings
      │                                 │
      │  4. 提交事务 ───────────────────►│
      │                                 │
```

**缺点**: 复杂度高、性能差、锁竞争

### 3.3 一致性风险矩阵

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 消息丢失 | 持仓不更新 | 消息持久化 + ACK |
| 消息重复 | 持仓重复更新 | 幂等处理 |
| 消息延迟 | 持仓更新慢 | 监控 + 告警 |
| 服务宕机 | 数据不一致 | 补偿事务 |

---

## 4. 数据冗余策略

### 4.1 冗余数据清单

| 数据 | 拥有者 | 冗余位置 | 更新频率 |
|------|--------|----------|----------|
| 用户ID | auth_db | game_db, trading_db | 注册时 |
| 用户名 | auth_db | game_db | 注册时 |
| 最新价格 | market_db | game_db (缓存) | 5s TTL |

### 4.2 冗余更新策略

```yaml
cache_update:
  price_cache:
    ttl_seconds: 5
    refresh_on_access: true
    background_refresh: true
```

---

## 5. 迁移策略

### 5.1 从单体到微服务

```
Phase 1: 数据库拆分 (不停服)
  - 创建新数据库
  - 双写旧+新数据库
  - 数据迁移

Phase 2: 服务拆分
  - 创建新服务
  - 流量切换 (灰度)
  - 下线旧服务
```

### 5.2 回滚方案

- 保留旧数据库 30 天
- 双向同步开关
- 快速切回能力
