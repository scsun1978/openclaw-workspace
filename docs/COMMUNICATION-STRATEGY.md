# 服务间通信策略

## 1. 通信协议选型

### 1.1 同步通信

| 场景 | 协议 | 原因 |
|------|------|------|
| 外部API | REST/HTTP | 简单、兼容性好 |
| 服务间查询 | gRPC | 高性能、类型安全 |
| 文件传输 | HTTP/2 | 支持流式传输 |

### 1.2 异步通信

| 场景 | 协议 | 原因 |
|------|------|------|
| 事件通知 | Redis Streams | 低延迟、简单 |
| 任务队列 | RabbitMQ | 可靠性、持久化 |
| 广播消息 | Redis Pub/Sub | 实时性 |

---

## 2. 通信矩阵

```
                 Auth   Trading   Market   Game
    Auth           -       -         -       ✉
    Trading        -       -         📞      📢
    Market         -       -         -       -
    Game           📞      -         📞      -

📞 = 同步调用 (gRPC/HTTP)
📢 = 异步事件 (Redis Streams)
✉ = Token验证 (无直接调用)
```

---

## 3. 延迟预期

| 调用路径 | 协议 | 预期延迟 | P99目标 |
|----------|------|----------|---------|
| Gateway → Service | HTTP | 5-10ms | 50ms |
| Trading → Market | gRPC | 2-5ms | 20ms |
| Trading → Game (async) | Redis | <1ms | 10ms |
| Game → Market | HTTP | 5-10ms | 50ms |

---

## 4. 故障隔离策略

### 4.1 熔断器配置

```yaml
circuit_breaker:
  failure_threshold: 5
  timeout_ms: 5000
  reset_timeout_ms: 30000
```

### 4.2 降级策略

| 服务故障 | 降级行为 |
|----------|----------|
| Market 不可用 | 返回缓存价格，标记延迟 |
| Auth 不可用 | 拒绝新请求，保持现有会话 |
| Trading 不可用 | 进入只读模式 |
| Game 不可用 | 返回基础数据 |

### 4.3 重试策略

```yaml
retry:
  max_attempts: 3
  backoff_ms: 100
  backoff_multiplier: 2
  max_backoff_ms: 1000
```

---

## 5. 消息格式

### 5.1 事件消息标准

```json
{
  "event_id": "uuid",
  "event_type": "trade.executed",
  "timestamp": "2026-02-19T12:00:00Z",
  "source": "trading-service",
  "version": "1.0",
  "payload": {
    "order_id": "123",
    "user_id": "456",
    "symbol": "AAPL",
    "quantity": 100,
    "price": 150.00
  }
}
```

### 5.2 事件类型清单

| 事件 | 发布者 | 订阅者 |
|------|--------|--------|
| trade.executed | Trading | Game, Market |
| order.created | Trading | Market |
| user.registered | Auth | Game |
| price.updated | Market | Trading, Game |
| holding.changed | Game | - |

---

## 6. 可靠性保障

### 6.1 消息持久化
- Redis Streams: AOF 持久化
- RabbitMQ: 消息持久化 + 确认机制

### 6.2 幂等性
- 所有事件带唯一 event_id
- 消费者维护已处理事件缓存
- 防止重复消费

### 6.3 死信处理
- 失败消息转入 DLQ
- 告警通知运维
- 手动重试机制
