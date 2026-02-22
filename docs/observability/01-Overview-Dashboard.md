# Observability Overview Dashboard

> **Dashboard UID**: `openclaw-overview`  
> **访问地址**: http://localhost:3000/d/openclaw-overview

## 用途

提供 OpenClaw 系统的整体健康状态一览，是运维人员的**首选入口**。

## 面板说明

### 顶部统计卡片

| 面板 | 数据源 | 含义 | 告警阈值 |
|------|--------|------|----------|
| 📊 Services Up | VM | 当前在线的服务数量 | < 5 触发告警 |
| 🔴 Errors (5m) | Loki | 5分钟内的错误日志数 | > 10 黄色, > 50 红色 |
| 📝 Log Lines (5m) | Loki | 5分钟内的日志总量 | - |
| 💾 Free Memory | VM | 系统空闲内存百分比 | < 20% 黄色, < 10% 红色 |

### 图表区域

#### 📈 Log Volume by Component
- **用途**: 按组件显示日志量分布
- **帮助发现**: 哪个组件最活跃，是否有异常日志爆发
- **典型组件**: `gateway`, `agent:nested`, `exec`, `ws`, `heartbeat`

#### ⚠️ Error Rate Trend
- **用途**: 错误率时间趋势
- **帮助发现**: 错误是否有上升趋势
- **行动**: 如果持续上升，查看 Error Analysis Dashboard

#### 🖥️ System CPU
- **用途**: CPU 使用率按模式分布
- **显示**: user, system, idle 等模式
- **告警**: 持续 > 80% 需关注

#### 💾 Memory Usage
- **用途**: 内存使用趋势
- **显示**: Used vs Free
- **告警**: 空闲 < 10% 需立即处理

#### 📋 All Logs (Live)
- **用途**: 实时日志流
- **操作**: 点击日志行查看详情

#### 🚨 Errors Only
- **用途**: 仅显示错误级别日志
- **操作**: 快速定位问题

## 运维场景

### 场景 1: 日常巡检
1. 打开 Dashboard
2. 检查 Services Up = 5
3. 检查 Errors (5m) < 10
4. 检查 Free Memory > 20%

### 场景 2: 收到告警后
1. 查看 Error Rate Trend 是否有峰值
2. 查看 Errors Only 日志
3. 根据组件跳转到对应 Dashboard

### 场景 3: 性能问题排查
1. 查看 CPU 和 Memory 趋势
2. 查看 Log Volume by Component 找活跃组件
3. 结合 Tracing Dashboard 分析延迟

## 相关 Dashboard

- 发现错误增多 → [[02-Error-Analysis-Dashboard]]
- 需要分析 Agent → [[03-Token-Agent-Dashboard]]
- 需要分析延迟 → [[04-Tracing-Dashboard]]

---
#OpenClaw #Dashboard #Overview
