# Token & Agent Monitor Dashboard

> **Dashboard UID**: `openclaw-tokens`  
> **访问地址**: http://localhost:3000/d/openclaw-tokens

## 用途

监控 **Token 使用情况**和 **Agent 活动状态**，帮助优化成本和性能。

## 面板说明

### 📊 Token 使用统计

| 面板 | 含义 | 用途 |
|------|------|------|
| 📊 Token 活动日志 (1h) | Token 相关日志数 | 监控 Token 使用频率 |
| 📊 Runtime 日志 (1h) | 运行时报告数 | 监控任务完成情况 |
| 📊 Cron 完成 (1h) | Cron 任务完成数 | 监控定时任务 |
| 📊 Agent 消息 (1h) | Agent 消息数 | 监控 Agent 活动量 |

### 📈 Token 使用趋势

#### Token 使用趋势图
- **Token Events**: Token 相关事件
- **Runtime Reports**: 运行时报告
- **用途**: 观察 Token 消耗趋势

#### Agent 活动趋势图
- **Agent Activity**: Agent 活动量
- **用途**: 识别高峰期和低谷期

### 🤖 Agent & Session 监控

| 面板 | 含义 | 正常值 |
|------|------|--------|
| 🤖 Nested Agent (1h) | 嵌套 Agent 活动数 | 取决于工作负载 |
| 📨 Session Send (1h) | 会话发送次数 | 取决于交互量 |
| ⏱️ Timeout 事件 (1h) | 超时事件数 | < 10 |
| 🔄 Cron 任务 (1h) | Cron 任务数 | 稳定 |

### 📋 详细日志

#### 📝 Token/Runtime 日志
- 包含 "tokens" 或 "runtime" 的日志
- 用于分析具体 Token 消耗

#### 🤖 Agent Activity 日志
- Agent 嵌套执行日志
- 用于追踪 Agent 调用链

#### ⏰ Cron 任务日志
- Cron 相关日志
- 用于监控定时任务执行

## Token 分析

### Token 消耗来源

1. **用户对话**: 直接与用户的交互
2. **Agent 嵌套**: Agent 之间的通信
3. **Cron 任务**: 定时执行的任务
4. **工具调用**: Function calling 的输入输出

### 成本优化建议

| 场景 | 优化方法 |
|------|----------|
| Token 消耗高 | 使用更便宜的模型 (如 GLM-5) |
| 嵌套过多 | 减少 Agent 嵌套层级 |
| Cron 频繁 | 降低 Cron 执行频率 |
| 输出过长 | 限制输出 token 数 |

## Agent 监控

### Nested Agent 活动

- **正常**: 稳定的活动量
- **异常**: 突然增加或减少

**可能原因**:
- 增加: 用户请求增多、复杂任务
- 减少: Provider 问题、任务队列空

### Session 通信

- **Session Send**: 跨 Session 消息发送
- **Timeout**: 发送超时次数

**诊断**:
- Timeout 多 → 网络问题或目标 Session 负载高
- Send 少 → 检查是否需要主动推送

## 运维场景

### 场景 1: Token 成本分析
1. 查看 Token Events 趋势
2. 查看 Token/Runtime 日志
3. 识别高消耗时段
4. 优化 Prompt 或切换模型

### 场景 2: Agent 性能问题
1. 查看 Agent Activity 趋势
2. 查看 Timeout 事件
3. 查看 Agent Activity 日志
4. 优化 Agent 响应时间

### 场景 3: Cron 任务监控
1. 查看 Cron 完成 数
2. 查看 Cron 任务日志
3. 确认任务按时执行
4. 检查任务执行结果

## 相关指标

由于 OpenClaw 目前不暴露 Prometheus 指标，Token 数据主要来自日志分析：

```logql
# Token 相关日志
{job="openclaw-gateway"} |~ "(?i)tokens"

# Runtime 报告
{job="openclaw-gateway"} |~ "(?i)runtime"

# Agent 活动
{job="openclaw-gateway", component="agent:nested"}
```

## 相关 Dashboard

- 系统概览 → [[01-Overview-Dashboard]]
- 错误分析 → [[02-Error-Analysis-Dashboard]]
- 性能分析 → [[04-Tracing-Dashboard]]

---
#OpenClaw #Dashboard #Tokens #Agent
