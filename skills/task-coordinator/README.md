# Task Coordinator Skill - 使用指南

> 自动协调 Team-Tasks 项目，让 Monitor Agent 充当"项目经理"

---

## ✅ 已完成部署

**部署时间**: 2026-02-17 15:43

**已创建文件**:
- ✅ `SKILL.md` - 技能文档
- ✅ `scripts/coordinator.py` - 核心协调脚本
- ✅ `scripts/check_projects.sh` - 快速检查脚本
- ✅ `config.json` - 配置文件
- ✅ `cron` 任务 - 每 5 分钟自动执行

---

## 🎯 功能验证

**测试结果**:
```
🔍 检查所有项目...

🔍 检查项目: login-feature
  ⚠️  发现停滞任务: monitor-agent
     停滞时间: 112.8 分钟

🔍 检查项目: task-cli
  ⚠️  发现停滞任务: qa-agent
     停滞时间: 35.8 分钟

⚠️  发现 2 个停滞任务

📤 开始推送...
  ✅ login-feature/monitor-agent: 推送成功
  ✅ task-cli/qa-agent: 推送成功
```

---

## 🚀 使用方法

### 1. 自动模式（推荐）

**已配置 cron 任务，每 5 分钟自动执行：**
- 检查所有项目
- 发现停滞任务（超过阈值）
- 自动推送到对应 agent
- 记录推送日志

**无需手动操作！**

---

### 2. 手动模式

**检查所有项目：**
```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --check-all
```

**检查并推送：**
```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --check-all --push
```

**检查特定项目：**
```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --project task-cli --push
```

**查看状态：**
```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --status
```

---

### 3. 使用 Shell 脚本

```bash
bash /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/check_projects.sh
```

---

## 📊 配置说明

### 超时阈值

| Agent | 超时时间 | 说明 |
|-------|---------|------|
| code-agent | 15 分钟 | Code 需要更多时间 |
| qa-agent | 10 分钟 | QA 标准时间 |
| docs-agent | 10 分钟 | Docs 标准时间 |
| monitor-agent | 5 分钟 | Monitor 需要快速响应 |

### 推送策略

- **最大推送次数**: 3 次/天
- **推送间隔**: 5 分钟
- **升级机制**: 超过 30 分钟未响应 → 通知 Monitor Agent

---

## 🔄 工作流程

```
每 5 分钟
    ↓
检查所有项目
    ↓
发现停滞任务？
    ↓
是 → 推送到 agent
    ↓
记录日志
    ↓
等待下次检查
```

---

## 📝 日志查看

**日志位置**: `/Users/shengchun.sun/.openclaw/workspace/logs/coordinator-YYYY-MM-DD.json`

**查看今天的日志：**
```bash
cat /Users/shengchun.sun/.openclaw/workspace/logs/coordinator-$(date +%Y-%m-%d).json
```

---

## ⚙️ Cron 任务管理

**查看任务：**
```bash
# 使用 OpenClaw cron 工具
# 或直接查看配置
```

**任务 ID**: `74ff67ed-7ba6-4d57-a0cd-f43eb2bd25cc`
**执行频率**: 每 5 分钟
**下次执行**: 5 分钟后

**禁用任务：**
```bash
# 在 OpenClaw 中执行
cron update 74ff67ed-7ba6-4d57-a0cd-f43eb2bd25cc --enabled false
```

---

## 🎯 与 Team-Tasks 集成

**完整工作流：**

```
1. 创建项目 (tm init)
   ↓
2. 分配任务 (tm assign)
   ↓
3. Agent 开始工作
   ↓
4. Task Coordinator 自动监控
   ↓
5. 如果停滞 → 自动推送
   ↓
6. Agent 继续工作
   ↓
7. 完成并推进到下一阶段
```

---

## 💡 优势

1. ✅ **完全自动化**：无需手动干预
2. ✅ **智能检测**：根据时间阈值判断
3. ✅ **分级处理**：先推送，后升级
4. ✅ **可追溯**：完整日志记录
5. ✅ **灵活配置**：可调整各种参数

---

## 🔧 故障排查

### 问题：任务没有被推送

**检查清单：**
1. ✅ Cron 任务是否启用
2. ✅ 超时阈值是否合理
3. ✅ 推送次数是否已达上限
4. ✅ 日志文件是否存在

### 问题：推送失败

**检查：**
```bash
# 查看日志
cat /Users/shengchun.sun/.openclaw/workspace/logs/coordinator-$(date +%Y-%m-%d).json

# 手动测试
python3 scripts/coordinator.py --check-all --push
```

---

## 📚 相关资源

- **Team-Tasks Skill**: `/workspace/skills/team-tasks/`
- **项目数据**: `/workspace/data/team-tasks/`
- **日志目录**: `/workspace/logs/`
- **配置文件**: `/workspace/skills/task-coordinator/config.json`

---

## 🎉 总结

**Task Coordinator 已成功部署并运行！**

- ✅ 自动化任务协调
- ✅ 定期检查和推送
- ✅ 完整日志记录
- ✅ 灵活配置选项

**现在，你的 Team-Tasks 项目将自动推进，无需手动干预！**

---

> 📝 创建日期：2026-02-17 15:43
> 🎯 维护者：scsun-monitor-agent
> 📊 状态：✅ 运行中
