# ctx-memory-optimizer 使用示例

## 示例 1: 项目推进场景

### 用户输入
```
/ctx-memory-optimizer compact
```

### 助手输出
使用项目推进模板：

```
请复制以下内容，在 /compact 命令后附加：

---

## Decision（已确认决策）
1. 使用 zai/glm-5 作为主模型
2. 配置本地 vLLM embedding 服务
3. 启用 memoryFlush 自动保存

## Constraints（关键约束）
1. Memory 搜索需要 embedding 服务
2. 会话压缩前需要手动保存重要信息

## Progress（当前进度）
- [x] 配置本地 embedding
- [x] 安装 ctx-memory-optimizer 技能
- [ ] 测试完整工作流

## Open Questions
1. 是否需要配置 contextPruning？

## Next Steps
1. 测试 /ctx-memory-optimizer status
2. 验证 Memory 搜索功能
```

---

## 示例 2: 故障排查场景

### 用户输入
```
/ctx-memory-optimizer compact 事故
```

### 助手输出
使用故障处置模板：

```
请复制以下内容，在 /compact 命令后附加：

---

## Symptoms/Impact
- 现象: Memory 索引失败
- 影响: 无法搜索历史记忆
- 时间: 2026-02-21

## Timeline
- 03:00 - 发现 memory index 失败
- 03:15 - 定位问题：缺少 API Key
- 03:30 - 配置本地 embedding 服务
- 03:45 - 验证成功

## Root Cause
- OpenClaw 默认需要 OpenAI/Google/Voyage API Key
- 本地 embedding 配置未被正确识别

## Fix/Change
- 配置 agents.defaults.memorySearch.remote.baseUrl
- 设置 apiKey: "not-needed"

## Validation
- 方法: openclaw memory index
- 结果: ✅ 索引成功，71/71 文件

## Risks/Follow-ups
- 风险: vLLM 服务需保持运行
- TODO: 监控 embedding 服务状态
```

---

## 示例 3: 记忆沉淀

### 用户输入
```
/ctx-memory-optimizer memory
```

### 助手输出
```
请将以下内容写入 memory/YYYY-MM-DD.md：

# 2026-02-21 OpenClaw Memory 配置

> 创建时间: 2026-02-21 03:45
> 状态: 已完成

## Decision
1. 使用本地 vLLM embedding 服务
2. 配置 OpenAI 兼容模式
3. 端口 8001

## Rationale
- 避免 OpenAI API Key 依赖
- 利用本地 GPU 资源
- 零成本运行

## Constraints
- vLLM 服务必须保持运行
- 使用 Qwen3-Embedding-0.6B 模型

## Commands
```bash
# 检查 embedding 服务
curl http://localhost:8001/v1/models

# 重建索引
openclaw memory index

# 搜索
openclaw memory search "关键词"
```

## Links
- [Memory 文档](https://docs.openclaw.ai/zh-CN/concepts/memory)

## TODO
- [x] 配置本地 embedding
- [x] 重建索引
- [ ] 监控服务状态
```
