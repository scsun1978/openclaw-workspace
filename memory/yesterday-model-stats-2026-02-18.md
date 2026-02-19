# 模型使用统计报告
时间范围：昨天 (2026-02-18)

---

## 总体情况

- 总调用次数：约 50 次（基于采样）
- 主要使用的模型：gpt-5.3-codex, glm-5, gemini-3-flash
- 主要活动：stock-simgame-live 项目 W1-W4 Gate Review、文档生成、QA 验收

---

## 模型分布

| 模型 | 调用次数（估算） | 占比 | 主要用途 |
|------|----------------|------|----------|
| **glm-5** (zai) | ~30 次 | 60% | 日常任务、Gate Review、文档编写 |
| **gpt-5.3-codex** (openai-codex) | ~15 次 | 30% | 复杂分析、Dashboard 规格设计 |
| **gemini-3-flash** (google-antigravity) | ~5 次 | 10% | QA 验收、辅助分析 |

---

## Agent 分布

| Agent | 调用次数 | 主要模型 | 使用场景 |
|-------|---------|---------|----------|
| **monitor-agent** | ~25 次 | glm-5 (70%), gpt-5.3-codex (20%), gemini-3-flash (10%) | Gate Review、项目协调、任务分配 |
| **docs-agent** | ~10 次 | glm-5 (100%) | CHANGELOG、RELEASE-NOTES、README 更新 |
| **qa-agent** | ~10 次 | glm-5 (50%), gemini-3-flash (50%) | W4 验收、压测分析、覆盖率报告 |
| **code-agent** | ~5 次 | glm-5 (100%) | WebSocket 修复、压测脚本、RC 版本发布 |

---

## Fallback 情况

**Fallback 触发次数**：0 次

- 所有调用均使用 Primary 模型成功
- 未发现明显的 Fallback 链路触发
- 模型稳定性良好

---

## 详细说明

### 数据来源
- 基于昨天 5 个活跃会话的消息历史采样
- 包含 Telegram 群组和 Cron 任务会话

### 主要活动
1. **W1-W4 Gate Review**：monitor-agent 使用 glm-5 和 gpt-5.3-codex 进行多方协调
2. **文档生成**：docs-agent 使用 glm-5 生成 W4 发布文档
3. **QA 验收**：qa-agent 使用 glm-5 和 gemini-3-flash 进行回归测试和压测分析
4. **代码修复**：code-agent 使用 glm-5 完成心跳竞态修复

### 成本估算
- glm-5：成本较低，大部分调用免费（基于 usage.cost 显示）
- gpt-5.3-codex：少量付费调用（主要用于复杂任务）
- gemini-3-flash：成本中等，主要用于 QA 辅助

### 模型选择策略
- **简单任务**：优先使用 glm-5（成本低、响应快）
- **复杂分析**：使用 gpt-5.3-codex（能力强）
- **QA 任务**：混合使用 glm-5 和 gemini-3-flash（平衡成本和质量）

---

**报告生成时间**：2026-02-19 09:00 (Asia/Shanghai)  
**数据范围**：2026-02-18 00:00 - 23:59  
**生成方式**：基于会话历史采样分析
