# Team Tasks Skill - Simplified Version

这是 team-tasks skill 的简化版本，包含了基本的 Linear 模式功能。

## 📦 已安装内容

- ✅ `SKILL.md` - 完整的 skill 文档
- ✅ `scripts/task_manager.py` - 简化版 CLI 工具（支持 Linear 模式）
- ✅ 数据目录：`/Users/shengchun.sun/.openclaw/workspace/data/team-tasks/`

## 🎯 快速开始

### 1. 创建项目

```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/scripts/task_manager.py \
  init my-project \
  -g "Build a REST API" \
  -m linear \
  -p "code-agent,test-agent,docs-agent"
```

### 2. 分配任务

```bash
# 分配任务到各个阶段
python3 scripts/task_manager.py assign my-project code-agent "Implement Flask API"
python3 scripts/task_manager.py assign my-project test-agent "Write pytest tests"
python3 scripts/task_manager.py assign my-project docs-agent "Write README"
```

### 3. 执行流程

```bash
# 查看下一个阶段
python3 scripts/task_manager.py next my-project

# 更新状态
python3 scripts/task_manager.py update my-project code-agent in-progress

# 保存结果
python3 scripts/task_manager.py result my-project code-agent "Created app.py"

# 标记完成
python3 scripts/task_manager.py update my-project code-agent done
```

### 4. 查看状态

```bash
python3 scripts/task_manager.py status my-project
```

## 🔧 添加别名

为了方便使用，可以添加别名：

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
alias tm='python3 /Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/scripts/task_manager.py'

# 使用
tm init my-project -g "Goal" -p "agent1,agent2"
tm status my-project
```

## 📥 获取完整版本

简化版只支持 Linear 模式。要使用 DAG 和 Debate 模式，需要克隆完整版本：

```bash
cd /Users/shengchun.sun/.openclaw/workspace/skills
git clone https://github.com/win4r/team-tasks.git team-tasks-full

# 使用完整版
python3 team-tasks-full/scripts/task_manager.py --help
```

## 🎭 完整版功能

- ✅ Linear 模式（顺序执行）
- ✅ DAG 模式（依赖图，并行执行）
- ✅ Debate 模式（多 agent 辩论）
- ✅ 依赖管理
- ✅ 循环检测
- ✅ 详细日志

## 📚 文档

完整文档见 `SKILL.md`，包含：
- 所有模式的详细说明
- CLI 命令参考
- 集成示例
- 常见陷阱

## 🔗 链接

- GitHub: https://github.com/win4r/team-tasks
- OpenClaw Docs: https://docs.openclaw.ai
