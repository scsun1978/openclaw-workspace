---
name: model-observer
description: 模型使用情况可观测工具，用于统计和分析各 agent 的模型调用情况。支持手动查询（命令：/model-stats 或 模型统计）和定期报告（每天/每周自动推送）。Use when: (1) 用户询问模型使用情况、成本分析、性能统计，(2) 需要查看各 agent 的模型调用分布，(3) 需要监控 fallback 链路的使用情况，(4) 用户说 "/model-stats" 或 "模型统计" 或 "查看模型使用情况"。
---

# Model Observer - 模型使用可观测工具

提供模型调用的统计、分析和报告功能。

## 核心功能

### 1. 手动查询

**命令触发：**
- `/model-stats`
- `模型统计`
- `查看模型使用情况`
- `模型调用统计`

**输出内容：**
- 各模型调用次数
- Primary vs Fallback 使用比例
- 各 agent 的模型使用分布
- 响应时间统计
- 成功/失败率

### 2. 定期报告

**自动推送：**
- 每天早上 9:00 推送昨天统计
- 每周一早上 9:00 推送上周汇总

**推送渠道：**
- 发送到 monitor agent 的 Telegram 群（`-5186938821`）

## 使用方法

### 手动查询

用户可以直接说：
```
/model-stats
模型统计
查看今天的模型使用情况
```

Agent 会：
1. 调用统计脚本
2. 收集会话数据
3. 生成格式化报告
4. 返回给用户

### 定期报告

由 cron 自动触发，无需用户干预。

## 技术实现

### 数据收集

使用 OpenClaw 提供的 API：
- `sessions_list` - 获取会话列表
- `sessions_history` - 获取会话历史
- 从历史记录中提取：
  - 使用的模型（`provider/model`）
  - 响应时间
  - Token 消耗
  - 成功/失败状态

### 统计维度

**按时间：**
- 今天
- 昨天
- 本周
- 上周
- 最近 7 天
- 最近 30 天

**按 Agent：**
- monitor
- code
- docs
- qa

**按模型：**
- `openai-codex/gpt-5.3-codex`
- `zai/glm-5`
- `google-antigravity/gemini-3-flash`
- `google-antigravity/gemini-3-pro-high`
- `anthropic/claude-opus-4-6`

### 输出格式

```
📊 模型使用统计报告
时间范围：2026-02-16 ~ 2026-02-17

## 总体情况
- 总调用次数：156
- 平均响应时间：2.3s
- 成功率：98.7%

## 模型分布
codex:     45 次 (28.8%) | 平均 1.2s
glm-5:     62 次 (39.7%) | 平均 2.5s
gemini-flash: 38 次 (24.4%) | 平均 1.8s
anthropic: 11 次 (7.1%) | 平均 3.5s

## Agent 分布
monitor: 52 次 | codex (86%), glm-5 (14%)
code:    48 次 | glm-5 (100%)
docs:    31 次 | glm-5 (100%)
qa:      25 次 | glm-5 (100%)

## Fallback 情况
- Primary 成功率：96.2%
- Fallback 触发次数：6
  - glm-5 → gemini-flash: 4 次
  - gemini-flash → anthropic: 2 次
```

## 脚本说明

### scripts/collect_stats.js

核心统计脚本，负责：
1. 从 OpenClaw API 收集数据
2. 解析和聚合统计信息
3. 生成格式化报告

**使用方式：**
```bash
node scripts/collect_stats.js --period today
node scripts/collect_stats.js --period yesterday
node scripts/collect_stats.js --period week
```

## 配置说明

### 定期报告配置

在 OpenClaw 的 cron 配置中添加：

**每天报告：**
```json
{
  "name": "daily-model-stats",
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * *",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "生成昨天的模型使用统计报告并发送到 monitor 群",
    "model": "zai/glm-5"
  },
  "sessionTarget": "isolated"
}
```

**每周报告：**
```json
{
  "name": "weekly-model-stats",
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * 1",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "生成上周的模型使用统计汇总并发送到 monitor 群",
    "model": "zai/glm-5"
  },
  "sessionTarget": "isolated"
}
```

## 扩展性

### 未来功能

1. **成本计算**
   - 根据各模型的 pricing 计算总成本
   - 成本趋势分析

2. **告警机制**
   - Fallback 触发过多时告警
   - 响应时间过长时告警
   - 失败率过高时告警

3. **数据持久化**
   - 将统计数据保存到文件
   - 支持更长时间范围的查询

4. **可视化**
   - 生成图表
   - Web Dashboard

## 注意事项

1. **数据时效性**
   - 统计基于会话历史，可能有几分钟延迟
   - 重启后内存数据会丢失

2. **性能影响**
   - 统计查询会遍历会话历史
   - 大量历史数据时可能较慢

3. **隐私**
   - 不收集具体的消息内容
   - 只统计模型使用元数据
