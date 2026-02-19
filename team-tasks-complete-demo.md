# Team-Tasks 多 Agent 协调工具 - 完整演示

> 📅 创建日期：2026-02-17
> 🎯 目标：演示如何使用 Team-Tasks 协调 4 个 agent（monitor/code/docs/qa）完成开发任务

---

## 📋 目录

1. [简介](#简介)
2. [安装](#安装)
3. [三种模式](#三种模式)
4. [完整演示](#完整演示)
5. [实际使用](#实际使用)
6. [最佳实践](#最佳实践)

---

## 简介

### 什么是 Team-Tasks？

Team-Tasks 是一个多 Agent 协调工具，用于管理 AI agent 之间的协作流程。

**核心价值：**
- ✅ 标准化工作流
- ✅ 自动推进任务
- ✅ 状态追踪
- ✅ 信息传递

**适用场景：**
- 功能开发（Linear）
- 复杂项目（DAG）
- 代码审查（Debate）

---

## 安装

### 已安装位置

```
/Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/
```

### 基础命令

```bash
# 添加别名（推荐）
alias tm='python3 /Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/scripts/task_manager.py'

# 查看帮助
tm --help

# 数据目录
/Users/shengchun.sun/.openclaw/workspace/data/team-tasks/
```

### 安装完整版（支持 DAG + Debate）

```bash
cd /Users/shengchun.sun/.openclaw/workspace/skills
git clone https://github.com/win4r/team-tasks.git team-tasks-full
```

---

## 三种模式

### 1️⃣ Linear 模式（顺序执行）

**特点：**
- 顺序执行，一个阶段完成后自动推进
- 适合有明确先后顺序的任务

**使用场景：**
- Bug 修复
- 简单功能开发
- 步骤流程

**命令流程：**
```bash
# 1. 创建项目
tm init project-name -g "目标" -p "agent1,agent2,agent3"

# 2. 分配任务
tm assign project-name agent1 "任务描述"

# 3. 执行流程（循环）
tm next project-name                  # 获取下一阶段
tm update project-name agent1 in-progress  # 开始
# ... agent 工作 ...
tm result project-name agent1 "输出"       # 保存结果
tm update project-name agent1 done         # 完成

# 4. 查看状态
tm status project-name
```

---

### 2️⃣ DAG 模式（依赖图）

**特点：**
- 声明依赖关系
- 满足依赖的任务可以并行执行
- 自动循环检测

**使用场景：**
- 大型功能开发
- 复杂依赖关系
- 并行工作流

**命令流程：**
```bash
# 1. 创建 DAG 项目
tm init project-name -m dag -g "目标"

# 2. 添加任务和依赖
tm add project-name design -a docs-agent --desc "设计 API"
tm add project-name backend -a code-agent -d "design" --desc "实现后端"
tm add project-name frontend -a code-agent -d "design" --desc "实现前端"
tm add project-name test -a qa-agent -d "backend,frontend" --desc "集成测试"

# 3. 查看依赖图
tm graph project-name

# 4. 获取可执行任务（可能多个）
tm ready project-name

# 5. 并行执行
# ... dispatch 多个 agent ...
```

---

### 3️⃣ Debate 模式（多视角讨论）

**特点：**
- 同一问题发给多个 agent
- 收集不同观点
- 交叉评审
- 综合结论

**使用场景：**
- 代码审查
- 架构决策
- 技术方案评估

**命令流程：**
```bash
# 1. 创建辩论项目
tm init debate-name --mode debate -g "讨论主题"

# 2. 添加辩论者
tm add-debater debate-name agent-a --role "角色1"
tm add-debater debate-name agent-b --role "角色2"

# 3. 开始辩论
tm round debate-name start          # 第一轮：初始观点
tm round debate-name collect agent "观点"

tm round debate-name cross-review   # 第二轮：交叉评审
tm round debate-name collect agent "评审"

tm round debate-name synthesize     # 综合结论
```

---

## 完整演示

### 场景：开发用户登录功能

**项目信息：**
- 项目名：`login-feature`
- 目标：实现用户登录功能，包括代码、测试和文档
- 模式：Linear
- 参与者：code-agent, qa-agent, docs-agent, monitor-agent

---

### 步骤 1：创建项目

```bash
tm init login-feature \
  -g "实现用户登录功能，包括代码、测试和文档" \
  -p "code-agent,qa-agent,docs-agent,monitor-agent"
```

**输出：**
```
✅ Project 'login-feature' created (linear mode)
```

---

### 步骤 2：分配任务

```bash
# Code Agent: 实现登录 API
tm assign login-feature code-agent "实现登录 API：POST /api/login，包括 JWT token 生成和验证"

# QA Agent: 编写测试用例
tm assign login-feature qa-agent "编写登录功能的测试用例，覆盖率目标 95%+，必须包含：成功登录、密码错误、用户不存在、空参数、Token 过期、Token 篡改"

# Docs Agent: 编写文档
tm assign login-feature docs-agent "编写登录 API 的使用文档，包括：API 请求/响应示例、错误码说明、JWT 用法和过期策略、安全注意事项"

# Monitor Agent: 最终审核
tm assign login-feature monitor-agent "审核登录功能的实现、测试结果和文档质量，给出发布建议"
```

---

### 步骤 3：查看初始状态

```bash
tm status login-feature
```

**输出：**
```
📋 Project: login-feature
🎯 Goal: 实现用户登录功能，包括代码、测试和文档
📊 Status: active | Mode: linear
▶️ Current: code-agent

  ⬜ code-agent: pending
     Task: 实现登录 API：POST /api/login
  ⬜ qa-agent: pending
     Task: 编写登录功能的测试用例
  ⬜ docs-agent: pending
     Task: 编写登录 API 的使用文档
  ⬜ monitor-agent: pending
     Task: 审核登录功能的实现

  Progress: [░░░░] 0/4
```

---

### 步骤 4：Code Agent 执行

```bash
# 4.1 获取下一阶段
tm next login-feature
# ▶️ Next stage: code-agent

# 4.2 标记开始
tm update login-feature code-agent in-progress

# 4.3 分发给 code-agent（通过 sessions_send）
# 在 OpenClaw 中执行：
sessions_send(
  session_key="agent:scsun-code-agent:telegram:group:-5107037842",
  message="实现登录 API：POST /api/login，包括 JWT token 生成和验证"
)

# 4.4 等待 code-agent 完成...

# 4.5 保存结果
tm result login-feature code-agent "已完成登录接口开发，包括 JWT token 生成和验证。文件：app.py, auth/jwt.py"

# 4.6 标记完成
tm update login-feature code-agent done
# ▶️ Next: qa-agent (自动推进!)
```

---

### 步骤 5：QA Agent 执行

```bash
# 5.1 自动推进到 qa-agent（已在上一阶段完成）

# 5.2 标记开始
tm update login-feature qa-agent in-progress

# 5.3 分发给 qa-agent
sessions_send(
  session_key="agent:scsun-qa-agent:telegram:group:-5294088642",
  message="编写登录功能的测试用例，覆盖率目标 95%+"
)

# 5.4 QA Agent 完成标准：
# - 覆盖成功登录、密码错误、用户不存在、空参数、token过期/篡改
# - 输出可复现测试结果（通过/失败明细）
# - 给出发布建议：PASS / CONDITIONAL PASS / BLOCK

# 5.5 保存结果
tm result login-feature qa-agent "✅ 测试用例已完成
- 成功登录: PASS
- 密码错误: PASS
- 用户不存在: PASS
- 空参数: PASS
- Token 过期: PASS
- Token 篡改: PASS

覆盖率: 95%
发布建议: CONDITIONAL PASS（建议增加限流测试）"

# 5.6 标记完成
tm update login-feature qa-agent done
# ▶️ Next: docs-agent (自动推进!)
```

---

### 步骤 6：Docs Agent 执行

```bash
# 6.1 标记开始
tm update login-feature docs-agent in-progress

# 6.2 分发给 docs-agent
sessions_send(
  session_key="agent:scsun-docs-agent:telegram:group:-5277020999",
  message="编写登录 API 的使用文档，参考 QA 的测试场景"
)

# 6.3 Docs Agent 完成标准：
# - API 请求/响应示例
# - 错误码说明
# - 鉴权说明（JWT用法、过期策略）
# - 安全注意事项（不要明文存token）

# 6.4 保存结果
tm result login-feature docs-agent "✅ 文档已输出：docs/api/login-api.md

内容摘要：
- 3 种语言的请求示例（curl/JS/Python）
- JWT Token 完整使用指南（携带/刷新/过期处理）
- 8 种错误码 + 解决方案
- 6 项安全注意事项（含存储方式对比表）
- 4 个 FAQ

QA 状态：已覆盖 qa-agent 提出的所有测试场景"

# 6.5 标记完成
tm update login-feature docs-agent done
# ▶️ Next: monitor-agent (自动推进!)
```

---

### 步骤 7：Monitor Agent 最终审核

```bash
# 7.1 标记开始
tm update login-feature monitor-agent in-progress

# 7.2 分发给 monitor-agent
sessions_send(
  session_key="agent:scsun-monitor-agent:telegram:group:-5186938821",
  message="审核登录功能：
  
【Code 输出】登录接口实现，JWT token 生成和验证
【QA 输出】覆盖率 95%，CONDITIONAL PASS（建议增加限流测试）
【Docs 输出】完整 API 文档，3种语言示例，8种错误码，6项安全注意事项

请进行最终审核并给出发布建议。"
)

# 7.3 Monitor 审核要点：
# 1. 代码实现：功能完整性、安全标准
# 2. 测试覆盖：覆盖率是否足够？是否缺少关键测试？
# 3. 文档质量：是否清晰完整？
# 4. 最终建议：PASS / CONDITIONAL PASS / BLOCK

# 7.4 保存结果
tm result login-feature monitor-agent "✅ 最终审核完成

【审核结论】
1. 代码实现: 符合安全标准，JWT 实现正确
2. 测试覆盖: 95% 覆盖率，建议增加限流测试
3. 文档质量: 清晰完整，包含所有必要信息

【发布建议】CONDITIONAL PASS
- 可以发布到测试环境
- 建议在上线前增加限流测试
- 建议增加日志审计功能

【状态】✅ 项目完成，可以进入下一阶段"

# 7.5 标记完成
tm update login-feature monitor-agent done
# ✅ All stages complete!
```

---

### 步骤 8：查看最终状态

```bash
tm status login-feature
```

**输出：**
```
📋 Project: login-feature
🎯 Goal: 实现用户登录功能，包括代码、测试和文档
📊 Status: active | Mode: linear
✅ All stages complete!

  ✅ code-agent: done
     Task: 实现登录 API：POST /api/login
     Output: 已完成登录接口开发，包括 JWT token 生成和验证
     
  ✅ qa-agent: done
     Task: 编写登录功能的测试用例
     Output: 测试用例完成，覆盖率 95%，CONDITIONAL PASS
     
  ✅ docs-agent: done
     Task: 编写登录 API 的使用文档
     Output: 文档已输出：docs/api/login-api.md
     
  ✅ monitor-agent: done
     Task: 审核登录功能的实现
     Output: 最终审核完成，CONDITIONAL PASS

  Progress: [████] 4/4 ✅
```

---

## 实际使用

### 与 OpenClaw Agent 的集成

```python
# 伪代码：自动化工作流
while True:
    # 1. 获取下一阶段
    result = tm.next(project, --json)
    
    if not result:
        break  # 项目完成
    
    next_stage = json.loads(result)
    
    # 2. 标记开始
    tm.update(project, next_stage['agent'], 'in-progress')
    
    # 3. 分发给 agent
    sessions_send(
        session_key=f"agent:{next_stage['agent']}:telegram:group:xxx",
        message=next_stage['task']
    )
    
    # 4. 等待回复
    reply = wait_for_reply()
    
    # 5. 保存结果并完成
    tm.result(project, next_stage['agent'], reply)
    tm.update(project, next_stage['agent'], 'done')
```

---

### 在 OpenClaw 中使用

**1. 创建项目：**
```
用户: 创建一个新项目，开发用户注册功能
Agent: 好的，我来创建项目
[执行 tm init user-register -g "..." -p "code-agent,qa-agent,docs-agent,monitor-agent"]
```

**2. 自动协调：**
```
Agent: 当前在 code-agent 阶段
[通过 sessions_send 分发任务给 code-agent]
[等待回复]
[保存结果并推进到下一阶段]
```

**3. 状态查询：**
```
用户: 查看项目进度
Agent: [执行 tm status project]
```

---

## 最佳实践

### 1️⃣ 定义清晰的完成标准

**Code Agent：**
- ✅ 功能实现完成
- ✅ 代码审查通过
- ✅ 单元测试编写

**QA Agent：**
- ✅ 测试覆盖率 ≥ 90%
- ✅ 所有关键路径测试通过
- ✅ 输出发布建议

**Docs Agent：**
- ✅ API 文档完整
- ✅ 使用示例清晰
- ✅ 错误码和注意事项

**Monitor Agent：**
- ✅ 综合审核所有输出
- ✅ 给出明确发布建议
- ✅ 提出改进措施

---

### 2️⃣ 使用 Monitor 审核模板

```markdown
[MONITOR|STATUS|TASK_ID|PRIORITY]

📋 **项目审核报告**

**项目**: {project-name}
**目标**: {goal}
**审核时间**: {timestamp}

---

## 一、代码实现审核
- [ ] 功能完整性
- [ ] 代码质量
- [ ] 安全标准
**结论**: {PASS / FAIL / CONDITIONAL PASS}

## 二、测试覆盖审核
- [ ] 测试覆盖率达标（>90%）
- [ ] 关键路径测试完整
**结论**: {PASS / FAIL / CONDITIONAL PASS}

## 三、文档质量审核
- [ ] API 文档清晰
- [ ] 使用示例完整
**结论**: {PASS / FAIL / CONDITIONAL PASS}

## 四、最终发布建议
**综合评估**: {PASS / CONDITIONAL PASS / BLOCK}
```

---

### 3️⃣ 项目数据持久化

所有项目数据保存在：
```
/Users/shengchun.sun/.openclaw/workspace/data/team-tasks/<project>.json
```

**数据结构：**
```json
{
  "name": "project-name",
  "goal": "项目目标",
  "mode": "linear",
  "status": "active",
  "stages": {
    "code-agent": {
      "status": "done",
      "task": "任务描述",
      "output": "输出结果",
      "logs": [...]
    }
  }
}
```

---

## 附录

### A. 命令速查表

| 命令 | 用法 | 描述 |
|------|------|------|
| `init` | `tm init <name> -g "goal" -p "agent1,agent2"` | 创建项目 |
| `status` | `tm status <project>` | 查看状态 |
| `assign` | `tm assign <project> <agent> "task"` | 分配任务 |
| `update` | `tm update <project> <agent> <status>` | 更新状态 |
| `result` | `tm result <project> <agent> "output"` | 保存结果 |
| `next` | `tm next <project>` | 获取下一阶段 |
| `list` | `tm list` | 列出所有项目 |

### B. 状态值

| 状态 | 图标 | 含义 |
|------|------|------|
| `pending` | ⬜ | 等待执行 |
| `in-progress` | 🔄 | 正在执行 |
| `done` | ✅ | 已完成 |
| `failed` | ❌ | 失败 |
| `skipped` | ⏭️ | 跳过 |

### C. 相关资源

- **GitHub**: https://github.com/win4r/team-tasks
- **OpenClaw Docs**: https://docs.openclaw.ai
- **示例项目**: `/Users/shengchun.sun/.openclaw/workspace/data/team-tasks/login-feature.json`

---

## 总结

**Team-Tasks 的核心价值：**

1. ✅ **标准化流程**：每个阶段有明确的完成定义
2. ✅ **自动推进**：完成一个阶段自动进入下一个
3. ✅ **可追溯**：完整的日志和状态记录
4. ✅ **Agent 协作**：基于前面 agent 的输出做决策

**适用场景：**
- 功能开发（Linear）
- 复杂项目（DAG）
- 代码审查（Debate）

**下一步：**
- 尝试创建一个真实项目
- 探索 DAG 和 Debate 模式
- 与 OpenClaw agent 深度集成

---

> 📝 文档版本：1.0
> 📅 更新日期：2026-02-17
> 🎯 维护者：scsun-monitor-agent
