# 🧠 ctx-memory-optimizer 快速参考

## 命令速查

| 命令 | 功能 | 使用场景 |
|------|------|----------|
| `auto` | 自动诊断 | **最常用！一键检查** |
| `zhipu` | 智谱专属 | 智谱 AI 优化 |
| `status` | 健康检查 | 查看会话状态 |
| `tune` | 配置建议 | 优化配置 |
| `compact` | 压缩模板 | 手动压缩 |
| `memory` | 记忆模板 | 沉淀记忆 |
| `chapter` | 章节切换 | 主题变更 |

---

## 风险等级判断

| 等级 | 条件 | 建议 |
|------|------|------|
| 🟢 低 | Token < 30% | 继续工作 |
| 🟡 中 | Token 30-60% | 考虑压缩 |
| 🔴 高 | Token > 60% | 立即优化 |

---

## 智谱 AI 专属配置

```json
{
  "contextTokens": 150000,
  "compaction": {
    "memoryFlush": {
      "enabled": true,
      "softThresholdTokens": 10000
    }
  },
  "contextPruning": {
    "mode": "cache-ttl",
    "ttl": "1h"
  }
}
```

---

## 快速诊断流程

```
1. /ctx-memory-optimizer auto
2. 查看风险等级
3. 按 P0/P1/P2 执行建议
4. 必要时应用配置片段
```

---

## 最佳实践

1. **每个阶段结束**: 先 memory，再 compact
2. **工具输出变长**: 落文件 + 依赖 pruning
3. **主题切换**: /new + Memory 继承
4. **每日检查**: auto 命令
