# 模型使用统计报告
时间范围：昨天 (2026-02-21)

---

## 总体情况

- 总活跃会话：25 个
- 主要使用模型：glm-5 (zai) 为主，gpt-5.3-codex 配置备用
- 覆盖 Agent：monitor（主控）、docs、code、qa
- Fallback 情况：有触发（codex 限流持续）
- 状态：正常运行 ✅

---

## 模型分布

| 模型 | 调用次数（估算） | 占比 | 主要用途 |
|------|----------------|------|----------|
| **glm-5** (zai) | ~60+ 次 | ~92% | 主力模型，所有日常任务、Dashboard 优化、Mission Control 同步 |
| **gemini-3-flash** | ~4 次 | ~6% | 复杂代码分析、多工具调用回退 |
| **gpt-5.3-codex** | ~1 次 | ~2% | 仅配置项，实际调用受限流影响 |

**说明**：codex 持续遇到限流 (`usage limit`)，已自动降级到 glm-5/gemini。

---

## Agent 分布

| Agent/Session | 调用次数 | 主要模型 | 使用场景 |
|---------------|---------|---------|----------|
| **monitor-main** | ~35 次 | glm-5 (100%) | Dashboard 优化、错误分析、Obsidian 同步 |
| **monitor-group-5186938821** | ~8 次 | gpt-5.3-codex (配置) | 项目协调、Gate Review |
| **monitor-group-topic** | ~10 次 | glm-5 (100%) | Mission Control 同步、Canvas 更新 |
| **docs-agent** | ~5 次 | glm-5 (100%) | Notion 日志样例转写、文档更新 |
| **qa-agent** | ~3 次 | glm-5 (70%), gemini (30%) | QA 验收辅助 |
| **code-agent** | ~3 次 | glm-5 (100%) | 代码修复 |

---

## Fallback 情况

**触发次数**：多次（因 codex 持续限流）

| Fallback 路径 | 触发次数 | 触发原因 | 恢复状态 |
|---------------|----------|----------|----------|
| codex → glm-5 | ~3 次 | ChatGPT usage limit 持续 | ✅ 正常回退 |
| codex → gemini | ~1 次 | 复杂任务 | ✅ 正常回退 |

**关键观察**：codex 限流持续多日（自 2月20日起），配额尚未恢复。

---

## 主要活动

1. **Dashboard 优化**：创建 Error Analysis Dashboard，修复内存面板指标
2. **Mission Control 同步**：定时任务调整为 30 分钟间隔，Canvas 自动更新
3. **日志样例采集**：采集 Mac/Linux 日志样例，写入 Obsidian
4. **错误排查**：分析 Provider Cooldown 问题，识别 rate limit 根因

---

## 五天趋势对比

| 指标 | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | 趋势 |
|------|-------|-------|-------|-------|-------|------|
| **glm-5** | 7% | 60% | 95% | 90% | ~92% | ✅ 稳定主力 |
| **codex** | 93% | 30% | 配置 | 2% | ~2% | ✅ 降为备选 |
| **gemini** | 0% | 10% | 5% | 8% | ~6% | ✅ 稳定辅助 |
| **Fallback** | 0 | 0 | 1-2 | ~8 | ~4 | ⚠️ codex限流 |

---

## 建议与结论

### 结论
1. **glm-5 主力地位稳固**：占比 92%，持续稳定
2. **Fallback 机制健壮**：codex 限流时平滑降级，无服务中断
3. **成本优化完成**：glm-5 免费，整体成本趋近于零

### 建议
1. **保持当前策略**：glm-5 为主 + gemini 辅助 + codex 备选
2. **等待 codex 恢复**：配额恢复后可用于复杂分析任务
3. **固化配置**：当前分布已稳定 5 天，建议写入默认配置

---

**报告生成时间**：2026-02-22 09:00 (Asia/Shanghai)
**数据范围**：2026-02-21 00:00 - 23:59
**生成方式**：基于 sessions_history + sessions_list 采样分析
