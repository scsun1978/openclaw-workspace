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

## 2. Obsidian Mission Control 同步（Cron 每 5 分钟）
- Cron Job: obsidian-tasks-sync (d94f92e1-3f68-42d1-848d-0e62737b7831)
- 同步 Team-Tasks JSON → Obsidian Tasks/ 目录
- 更新 Tasks Board Canvas 看板视图
- 无需在 heartbeat 中重复执行

## 3. 记忆同步（已弃用 Notion）
- ~~Notion 记忆同步~~ → 删除
- 记忆统一存储在：Obsidian Mission Control

---

# Add tasks below when you want the agent to check something periodically.
