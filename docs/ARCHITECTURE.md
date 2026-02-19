# Stock SimGame v1.5 微服务架构设计

## 1. 架构概览

### 1.1 设计目标
- **可扩展性**: 支持水平扩展，应对用户增长
- **高可用性**: 服务隔离，故障不扩散
- **可维护性**: 职责单一，独立部署

### 1.2 服务拓扑

```
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Kong/Nginx)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Auth Service  │    │Trading Service│    │ Market Service│
│   :3001       │    │   :3002       │    │   :3003       │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        │            ┌───────┴───────┐            │
        │            │               │            │
        ▼            ▼               ▼            ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  auth_db      │    │  trading_db   │    │  market_db    │
│  (PostgreSQL) │    │  (PostgreSQL) │    │  (TimescaleDB)│
└───────────────┘    └───────────────┘    └───────────────┘
                             │
                             ▼
                     ┌───────────────┐
                     │ Game Service  │
                     │   :3004       │
                     └───────┬───────┘
                             │
                             ▼
                     ┌───────────────┐
                     │   game_db     │
                     │  (PostgreSQL) │
                     └───────────────┘
```

## 2. 服务清单

| 服务 | 端口 | 职责 | 数据库 |
|------|------|------|--------|
| API Gateway | 80/443 | 路由、认证、限流 | - |
| Auth Service | 3001 | 用户认证、JWT管理 | auth_db |
| Trading Service | 3002 | 订单、撮合、交易 | trading_db |
| Market Service | 3003 | 行情、K线、价格 | market_db (TimescaleDB) |
| Game Service | 3004 | 用户、持仓、盈亏 | game_db |

## 3. 技术栈

- **语言**: Node.js 18+ / TypeScript
- **框架**: Express / Fastify
- **数据库**: PostgreSQL 15 + TimescaleDB
- **缓存**: Redis 7
- **消息队列**: Redis Streams / RabbitMQ
- **容器**: Docker + Kubernetes
- **监控**: Prometheus + Grafana
