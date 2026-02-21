# 🧠 ctx-memory-optimizer 完整使用指南

## 📋 命令列表

| 命令 | 功能 | 使用场景 |
|------|------|----------|
| `auto` | 自动诊断 | **最常用！一键检查** |
| `zhipu` | 智谱专属 | 智谱 AI 优化配置 |
| `status` | 健康检查 | 查看会话状态 |
| `tune` | 配置建议 | 优化 OpenClaw 配置 |
| `compact` | 压缩模板 | 手动压缩会话 |
| `memory` | 记忆模板 | 沉淀重要信息 |
| `chapter` | 章节切换 | 主题变更建议 |
| `playbook` | 完整手册 | 操作手册 |

---

## 🚀 快速开始

### 1️⃣ 一键诊断 (最常用)

```
/ctx-memory-optimizer auto
```

**输出内容:**
- 📊 会话健康状态
- ⚠️ 检测到的问题
- 📋 P0/P1/P2 优先级建议
- 🔧 可复制的配置片段

---

### 2️⃣ 智谱 AI 专属优化

```
/ctx-memory-optimizer zhipu
```

**输出内容:**
- 🇨🇳 智谱 AI 专属配置
- 204800 token 上下文优化
- memoryFlush 智能触发配置
- contextPruning 配置
- 会话分桶策略

---

### 3️⃣ 查看当前状态

```
/ctx-memory-optimizer status
```

**输出内容:**
- Memory 索引状态
- Compaction 配置
- ContextPruning 配置
- 主模型配置
- 风险等级评估

---

## 🎯 使用场景

### 场景 1: 长时间对话后

```
1. /ctx-memory-optimizer auto
2. 查看风险等级
3. 按 P0/P1/P2 优先级执行建议
4. 必要时应用配置片段
```

### 场景 2: 优化智谱 AI 配置

```
1. /ctx-memory-optimizer zhipu
2. 查看专属配置片段
3. 复制到 openclaw.json
4. 重启 Gateway 生效
```

### 场景 3: 准备压缩会话

```
1. /ctx-memory-optimizer compact
2. 选择项目模板或故障模板
3. 复制内容
4. /compact [粘贴模板内容]
```

### 场景 4: 保存重要信息

```
1. /ctx-memory-optimizer memory
2. 填写模板内容
3. 保存到 memory/YYYY-MM-DD.md
4. 信息可在后续会话中搜索
```

### 场景 5: 主题切换

```
1. /ctx-memory-optimizer chapter
2. 查看必须继承的信息
3. 写入 Memory
4. /new 或 /reset 开始新会话
```

---

## 🔧 配置应用

### 方式 1: 手动编辑

```bash
# 编辑配置文件
nano ~/.openclaw/openclaw.json

# 粘贴配置片段
# 保存退出

# 重启 Gateway
openclaw gateway restart
```

### 方式 2: 命令行设置

```bash
# 设置单个配置
openclaw config set agents.defaults.contextTokens 150000

# 设置嵌套配置
openclaw config set agents.defaults.compaction.memoryFlush.enabled true
```

---

## 📊 风险等级

| 等级 | 条件 | 建议 |
|------|------|------|
| 🟢 低 | Token < 30% | 继续工作，无需操作 |
| 🟡 中 | Token 30-60% | 考虑压缩和优化 |
| 🔴 高 | Token > 60% | 立即优化配置 |

---

## 💡 最佳实践

### 日常维护

```
每天: /ctx-memory-optimizer auto
每周: 检查 Memory 文件，清理过期内容
```

### 长期项目

```
阶段结束: memory → compact
工具输出长: 落文件 + pruning
主题切换: /new + Memory 继承
```

### 智谱 AI 专属

```
- 利用 204K 上下文
- memoryFlush 10K 触发
- contextPruning 1小时 TTL
- 单主题长时间运行
```

---

## 📁 技能文件

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 主技能定义 |
| `QUICK-REF.md` | 快速参考 |
| `templates/zhipu_optimized.json` | 智谱完整配置 |
| `templates/compact_project.txt` | 项目压缩模板 |
| `templates/compact_incident.txt` | 故障压缩模板 |
| `templates/memory_note.md` | 记忆笔记模板 |

---

## ❓ 常见问题

### Q: 什么时候使用 auto 命令？

**A:** 以下情况使用:
- 长时间对话后
- 感觉响应变慢
- 不确定当前状态
- 定期健康检查

### Q: zhipu 命令适合什么人？

**A:** 使用智谱 AI (zai/glm-5) 的用户

### Q: 配置片段如何应用？

**A:** 复制 JSON 片段到 `~/.openclaw/openclaw.json` 的对应位置

### Q: Memory 文件在哪里？

**A:** `~/.openclaw/workspace/memory/YYYY-MM-DD.md`

---

**🎉 现在你可以开始使用 ctx-memory-optimizer 技能了！**
