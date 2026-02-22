# Mission Control 数据对接方案

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                   OpenClaw Runtime                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Cron    │  │Sessions  │  │Subagents │  │ Memory  │ │
│  │  Jobs    │  │  List    │  │  List    │  │  Files  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │             │             │              │       │
│       └─────────────┴─────────────┴──────────────┘       │
│                          │                               │
│                    Cron Job 导出                         │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │  mission-control-export/        │
         │  ├── cron-status.json           │
         │  ├── sessions-status.json       │
         │  ├── subagents-status.json      │
         │  └── memory-index.json          │
         └─────────────┬───────────────────┘
                       ↓
         ┌─────────────────────────────────┐
         │     data_bridge.py              │
         │  - 读取导出的 JSON              │
         │  - 索引 memory 文件             │
         │  - 生成 Canvas 节点             │
         └─────────────┬───────────────────┘
                       ↓
         ┌─────────────────────────────────┐
         │   Obsidian Canvas 文件          │
         │  ├── Tasks Board.canvas         │
         │  ├── Team.canvas                │
         │  ├── Calendar.canvas ← 新增     │
         │  └── Memory.canvas   ← 新增     │
         └─────────────────────────────────┘
```

## 数据源映射

| Canvas | 数据源 | 更新频率 | 脚本 |
|--------|--------|----------|------|
| Tasks Board | team-tasks/*.json | 5分钟 | sync.py |
| Team | team-tasks/*.json | 5分钟 | sync.py |
| Calendar | cron-status.json | 15分钟 | data_bridge.py |
| Memory | memory/*.md | 5分钟 | data_bridge.py |

## 使用方式

### 自动同步 (推荐)
Cron 任务自动执行，无需手动操作。

### 手动触发
```bash
# 1. 导出 OpenClaw 状态 (需要 OpenClaw 执行)
# cron list → mission-control-export/cron-status.json
# sessions_list → mission-control-export/sessions-status.json

# 2. 运行数据桥接
python3 ~/.openclaw/workspace/skills/mission-control/scripts/data_bridge.py

# 3. 运行 Canvas 同步
python3 ~/.openclaw/workspace/skills/mission-control/scripts/sync.py
```

### 一键同步
告诉 OpenClaw: "同步 Mission Control"

## 扩展数据源

### 添加新数据源
1. 在 cron job 中添加导出逻辑
2. 保存到 `mission-control-export/xxx-status.json`
3. 修改 `data_bridge.py` 读取并生成 Canvas

### 示例：添加 GitHub Issues
```python
# 在 cron job payload 中添加:
# 执行 gh issue list 并保存到 github-issues.json

# 在 data_bridge.py 中添加:
def generate_github_canvas():
    issues = read_json(GITHUB_EXPORT, {"issues": []})
    # ... 生成 Canvas 节点
```

---

Created: 2026-02-21
