# HEARTBEAT.md

# 定期任务协调

每 30 分钟执行一次 Team-Tasks 项目检查：
- 执行：python3 /Users/shengchun.sun/.openclaw/workspace/skills/task-coordinator/scripts/coordinator.py --check-all
- 如果发现停滞任务，使用 sessions_send 推送到对应 agent
- 记录结果到日志

推送策略（减少 timeout 误报）：
- sessions_send timeoutSeconds 使用 900（长任务默认 300 容易超时）
- 同一 project/stage 15 分钟内不重复催办（先看是否已有回执）
- timeout 视为“未在窗口内回执”，不是“发送失败”
- 若已收到该阶段有效结果，先回填 team-tasks 再推进下一阶段，不再重复催办

检查逻辑：
1. 读取所有项目（task-cli.json, login-feature.json）
2. 检查每个阶段的最后日志时间
3. 如果超过阈值（code:15min, qa:10min, docs:10min, monitor:5min）
4. 使用 sessions_send 推送任务到对应 agent
5. 记录推送结果

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.
