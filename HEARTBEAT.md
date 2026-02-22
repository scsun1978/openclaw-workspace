# HEARTBEAT.md

# 定期任务协调

## 1. Team-Tasks 项目检查（每 30 分钟）
- 执行：python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --check-all
- 如果发现停滞任务，使用 sessions_send 推送到对应 agent
- 记录结果到日志

推送策略：
- sessions_send timeoutSeconds 使用 900
- 同一 project/stage 15 分钟内不重复催办
- 若已收到有效结果，先回填再推进

## 2. Mission Control 自动化（Cron 驱动）
- **Tasks/Team/Memory Sync**: 每 30 分钟 (cron: 9807f131...)
  - 自动导出 cron/sessions/subagents 状态到 JSON
  - 运行 data_bridge.py 更新 Memory/Calendar Canvas
  - 运行 sync.py 更新 Tasks/Team Canvas
- **Calendar Sync**: 每 30 分钟 (cron: c319911f...)
  - 更新 cron 状态并刷新 Calendar Canvas
- 脚本目录: `skills/mission-control/scripts/`
- 数据导出目录: `mission-control-export/`

## 3. 记忆同步（已弃用 Notion）
- ~~Notion 记忆同步~~ → 删除
- 记忆统一存储在：Obsidian Mission Control

---

# Add tasks below when you want the agent to check something periodically.
