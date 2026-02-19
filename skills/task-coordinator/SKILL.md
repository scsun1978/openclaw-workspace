# Task Coordinator Skill

> 自动协调 Team-Tasks 项目，让 Monitor Agent 充当"项目经理"

---

## 📋 功能概述

**核心职责：**
1. 定期检查所有 Team-Tasks 项目状态
2. 发现卡住的任务（pending/in-progress 超过阈值）
3. 使用 `sessions_send` 主动推送到对应 agent
4. 记录推送日志和结果

---

## 🎯 使用场景

**自动化协调：**
- 检测到 Code Agent 卡住 → 自动推送任务
- 检测到 QA Agent 超时 → 自动发送提醒
- 检测到项目停滞 → 通知 Monitor Agent

**定期检查：**
- 每 5 分钟检查一次所有项目
- 超过 10 分钟没有响应的任务自动推送

---

## 🔧 技能配置

### 文件结构

```
task-coordinator/
├── SKILL.md                 # 本文档
├── scripts/
│   ├── coordinator.py       # 核心协调脚本
│   └── check_projects.sh    # 快速检查脚本
└── config.json              # 配置文件
```

### 配置项

```json
{
  "check_interval_minutes": 5,
  "timeout_threshold_minutes": 10,
  "max_push_attempts": 3,
  "projects_dir": "/Users/shengchun.sun/.openclaw/workspace/data/team-tasks",
  "agents": {
    "code-agent": "agent:scsun-code-agent:telegram:group:-5107037842",
    "qa-agent": "agent:scsun-qa-agent:telegram:group:-5294088642",
    "docs-agent": "agent:scsun-docs-agent:telegram:group:-5277020999",
    "monitor-agent": "agent:scsun-monitor-agent:telegram:group:-5186938821"
  }
}
```

---

## 🚀 使用方法

### 1. 手动触发

```bash
# 检查所有项目
python3 scripts/coordinator.py --check-all

# 推送特定项目
python3 scripts/coordinator.py --project task-cli --push

# 查看状态
python3 scripts/coordinator.py --status
```

### 2. 自动化（Cron）

**添加定期任务：**
```bash
# 每 5 分钟检查一次
*/5 * * * * python3 /path/to/coordinator.py --check-all
```

### 3. 在 OpenClaw 中使用

**通过 Heartbeat 触发：**
在 `HEARTBEAT.md` 中添加：
```markdown
# 定期任务协调

检查 Team-Tasks 项目状态：
- 如果有任务卡住超过 10 分钟
- 自动推送到对应 agent
```

---

## 📊 协调逻辑

### 状态检测

```python
def check_project_status(project):
    """检查项目状态"""
    for stage_name, stage in project['stages'].items():
        if stage['status'] in ['pending', 'in-progress']:
            last_log_time = get_last_log_time(stage)
            if time.now() - last_log_time > TIMEOUT_THRESHOLD:
                return {
                    'stage': stage_name,
                    'status': stage['status'],
                    'stuck_duration': time.now() - last_log_time,
                    'task': stage['task']
                }
    return None
```

### 自动推送

```python
def push_to_agent(agent_name, task_info):
    """推送到 agent"""
    session_key = AGENTS[agent_name]
    message = f"""
[SYSTEM|AUTO-PUSH|{task_info['stage']}|P1]

📋 自动推送任务（检测到任务停滞）

项目: {project_name}
阶段: {task_info['stage']}
停滞时间: {task_info['stuck_duration']} 分钟

任务内容:
{task_info['task']}

请立即处理或更新进度。
"""
    
    sessions_send(
        sessionKey=session_key,
        message=message,
        timeoutSeconds=120
    )
```

---

## 🔄 工作流程

```
┌─────────────────────────────────────────┐
│  定期检查（每 5 分钟）                    │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  读取所有项目状态                        │
│  - task-cli.json                        │
│  - login-feature.json                   │
│  - ...                                  │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  检测停滞任务                            │
│  - pending/in-progress > 10 分钟        │
└──────────────┬──────────────────────────┘
               ↓
       ┌───────┴───────┐
       │   发现停滞？   │
       └───────┬───────┘
               ↓
    ┌──────────┴──────────┐
    │                     │
   YES                   NO
    │                     │
    ↓                     ↓
┌─────────┐         ┌─────────┐
│推送任务 │         │记录日志 │
└────┬────┘         └─────────┘
     ↓
┌─────────┐
│记录推送 │
│结果     │
└─────────┘
```

---

## 📝 日志记录

### 推送日志

**格式：**
```json
{
  "timestamp": "2026-02-17T15:35:00",
  "project": "task-cli",
  "stage": "qa-agent",
  "action": "auto-push",
  "result": "success",
  "message": "任务已推送",
  "next_check": "2026-02-17T15:40:00"
}
```

### 存储位置

```
/Users/shengchun.sun/.openclaw/workspace/logs/
├── coordinator-2026-02-17.json
├── coordinator-2026-02-18.json
└── ...
```

---

## ⚙️ 高级配置

### 超时阈值调整

```json
{
  "timeout_thresholds": {
    "code-agent": 15,    // Code 需要更多时间
    "qa-agent": 10,      // QA 标准时间
    "docs-agent": 10,    // Docs 标准时间
    "monitor-agent": 5   // Monitor 需要快速响应
  }
}
```

### 推送策略

```json
{
  "push_strategy": {
    "max_attempts": 3,           // 最多推送 3 次
    "backoff_minutes": 5,        // 每次间隔 5 分钟
    "escalation": true,          // 超过次数后升级到 Monitor
    "escalation_target": "monitor-agent"
  }
}
```

---

## 🎯 与 OpenClaw 集成

### 1. Heartbeat 集成

在 `HEARTBEAT.md` 中：
```markdown
# 定期任务协调

每 30 分钟检查 Team-Tasks 项目：
- 执行 coordinator.py --check-all
- 记录结果到日志
```

### 2. 监控面板

在 Monitor Agent 群里：
```
[COORDINATOR|STATUS|DAILY]

📊 今日协调统计：
- 检查次数: 288
- 推送次数: 12
- 成功率: 100%
- 最长停滞: 15 分钟

项目状态：
- task-cli: QA 阶段
- login-feature: 已完成
```

### 3. 告警机制

```python
if stuck_duration > 30:  # 超过 30 分钟
    # 发送到 Monitor Agent
    sessions_send(
        sessionKey="agent:scsun-monitor-agent:telegram:group:-5186938821",
        message=f"⚠️ 告警：{project_name} 停滞超过 30 分钟"
    )
```

---

## 🔍 故障排查

### 问题：Agent 没有响应

**检查清单：**
1. ✅ Agent 会话是否活跃（sessions_list）
2. ✅ 超时阈值是否合理
3. ✅ 推送次数是否已达上限
4. ✅ sessions_send 是否成功

### 问题：重复推送

**解决方案：**
```python
# 检查最近是否推送过
if last_push_time < 5_minutes_ago:
    push_to_agent(agent, task)
```

---

## 📚 相关资源

- **Team-Tasks Skill**: `/workspace/skills/team-tasks/`
- **项目数据**: `/workspace/data/team-tasks/`
- **日志目录**: `/workspace/logs/`
- **配置文件**: `/workspace/skills/task-coordinator/config.json`

---

## 🎉 优势

1. ✅ **完全自动化**：无需手动干预
2. ✅ **智能检测**：根据时间阈值判断
3. ✅ **分级处理**：先推送，后升级
4. ✅ **可追溯**：完整日志记录
5. ✅ **灵活配置**：可调整各种参数

---

> 📝 维护者：scsun-monitor-agent
> 📅 创建日期：2026-02-17
> 🎯 版本：1.0
