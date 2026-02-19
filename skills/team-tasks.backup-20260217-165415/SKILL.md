---
name: team-tasks
description: Multi-agent pipeline coordination tool for AI agent orchestration. Supports three modes: (1) Linear - sequential pipeline with auto-advance, (2) DAG - dependency graph with parallel dispatch, (3) Debate - multi-agent position + cross-review. Use when: (1) Coordinating multiple agents on a complex task, (2) Managing sequential or parallel workflows, (3) Running code reviews or architecture decisions with multiple perspectives, (4) User mentions "team-tasks" or "multi-agent pipeline" or "DAG workflow" or "agent debate".
---

# Team Tasks - Multi-Agent Pipeline Coordination

A Python CLI tool for coordinating multi-agent development workflows through shared JSON task files. Designed for use with OpenClaw and AI agent orchestration systems.

## Features

Three coordination modes for different workflows:

| Mode | Description | Use Case |
|------|-------------|----------|
| Linear | Sequential pipeline with auto-advance | Bug fixes, simple features, step-by-step workflows |
| DAG | Dependency graph with parallel dispatch | Large features, spec-driven dev, complex dependencies |
| Debate | Multi-agent position + cross-review | Code reviews, architecture decisions, competing hypotheses |

## Requirements

- Python 3.12+ (stdlib only, no external dependencies)
- Data stored as JSON in `/home/ubuntu/clawd/data/team-tasks/` (override with `TEAM_TASKS_DIR` env var)

## Quick Start

### Mode A: Linear Pipeline

A sequential pipeline where agents execute one after another in order.

```bash
TM="python3 scripts/task_manager.py"

# 1. Create project with pipeline order
$TM init my-api -g "Build REST API with tests and docs" \
  -p "code-agent,test-agent,docs-agent,monitor-bot"

# 2. Assign tasks to each stage
$TM assign my-api code-agent "Implement Flask REST API: GET/POST/DELETE /items"
$TM assign my-api test-agent "Write pytest tests, target 90%+ coverage"
$TM assign my-api docs-agent "Write README with API docs and examples"
$TM assign my-api monitor-bot "Security audit and deployment readiness check"

# 3. Check what's next
$TM next my-api
# ▶️ Next stage: code-agent

# 4. Dispatch → work → save result → mark done
$TM update my-api code-agent in-progress
# ... agent does work ...
$TM result my-api code-agent "Created app.py with 3 endpoints"
$TM update my-api code-agent done
# ▶️ Next: test-agent (auto-advance!)

# 5. Check progress anytime
$TM status my-api
```

**Output example:**
```
📋 Project: my-api
🎯 Goal: Build REST API with tests and docs
📊 Status: active | Mode: linear
▶️ Current: test-agent

  ✅ code-agent: done
     Task: Implement Flask REST API
     Output: Created app.py with 3 endpoints
  🔄 test-agent: in-progress
     Task: Write pytest tests, target 90%+ coverage
  ⬜ docs-agent: pending
  ⬜ monitor-bot: pending

  Progress: [██░░] 2/4
```

### Mode B: DAG (Dependency Graph)

Tasks declare dependencies and run in parallel when deps are met.

```bash
TM="python3 scripts/task_manager.py"

# 1. Create DAG project
$TM init my-feature -m dag -g "Build search feature with parallel workstreams"

# 2. Add tasks with dependencies
$TM add my-feature design -a docs-agent --desc "Write API spec"
$TM add my-feature scaffold -a code-agent --desc "Create project skeleton"
$TM add my-feature implement -a code-agent -d "design,scaffold" --desc "Implement API"
$TM add my-feature write-tests -a test-agent -d "design" --desc "Write test cases from spec"
$TM add my-feature run-tests -a test-agent -d "implement,write-tests" --desc "Run all tests"
$TM add my-feature write-docs -a docs-agent -d "implement" --desc "Write final docs"
$TM add my-feature review -a monitor-bot -d "run-tests,write-docs" --desc "Final review"

# 3. Visualize the DAG
$TM graph my-feature

# 4. Get ready tasks (parallel dispatch!)
$TM ready my-feature
# 🟢 Ready to dispatch (2 tasks):
# 📌 design → agent: docs-agent
# 📌 scaffold → agent: code-agent

# 5. Dispatch both in parallel, then mark done
$TM update my-feature design done
# 🟢 Unblocked: write-tests ← auto-detected!
```

**Key DAG features:**
- `ready` returns ALL tasks whose deps are satisfied — dispatch them simultaneously
- `ready --json` includes `depOutputs` — previous stage results to pass to agents
- Automatic unblock notifications when a task completes
- Cycle detection on `add` — rejects tasks that would create circular dependencies
- Partial failure: unrelated branches continue; only downstream tasks block

### Mode C: Debate (Multi-Agent Deliberation)

Send the same question to multiple agents, collect positions, cross-review, and synthesize.

```bash
TM="python3 scripts/task_manager.py"

# 1. Create debate project
$TM init security-review --mode debate \
  -g "Review auth module for security vulnerabilities"

# 2. Add debaters with roles/perspectives
$TM add-debater security-review code-agent --role "security expert focused on injection attacks"
$TM add-debater security-review test-agent --role "QA engineer focused on edge cases"
$TM add-debater security-review monitor-bot --role "ops engineer focused on deployment risks"

# 3. Start initial round
$TM round security-review start
# 🗣️ Debate Round 1 (initial) started
# Outputs dispatch prompts for each debater

# 4. Collect initial positions
$TM round security-review collect code-agent "Found SQL injection in login()"
$TM round security-review collect test-agent "Missing input validation on email field"
$TM round security-review collect monitor-bot "No rate limiting on auth endpoints"

# 5. Generate cross-review prompts
$TM round security-review cross-review
# 🔁 Each debater gets others' positions + review instructions

# 6. Collect cross-reviews
$TM round security-review collect code-agent "Agree on validation. Rate limiting is critical."
$TM round security-review collect test-agent "SQL injection is most severe. Adding rate limit tests."
$TM round security-review collect monitor-bot "Both findings valid. Recommending WAF as additional layer."

# 7. Synthesize all positions
$TM round security-review synthesize
# 🧾 Outputs all initial positions + cross-reviews for final synthesis
```

## CLI Reference

### All Commands

| Command | Mode | Usage | Description |
|---------|------|-------|-------------|
| `init` | all | `init <project> -g "goal" [-m linear\|dag\|debate]` | Create project |
| `add` | dag | `add <project> <task-id> -a <agent> -d <deps>` | Add task with deps |
| `add-debater` | debate | `add-debater <project> <agent-id> [-r "role"]` | Add debater |
| `round` | debate | `round <project> start\|collect\|cross-review\|synthesize` | Debate actions |
| `status` | all | `status <project> [--json]` | Show progress |
| `assign` | linear/dag | `assign <project> <stage> "desc"` | Set task description |
| `update` | linear/dag | `update <project> <stage> <status>` | Change status |
| `next` | linear | `next <project> [--json]` | Get next stage |
| `ready` | dag | `ready <project> [--json]` | Get dispatchable tasks |
| `graph` | dag | `graph <project>` | Show dependency tree |
| `log` | linear/dag | `log <project> <stage> "msg"` | Add log entry |
| `result` | linear/dag | `result <project> <stage> "output"` | Save stage output |
| `reset` | linear/dag | `reset <project> [stage] [--all]` | Reset to pending |
| `history` | linear/dag | `history <project> <stage>` | Show log history |
| `list` | all | `list` | List all projects |

### Status Values

| Status | Icon | Meaning |
|--------|------|---------|
| pending | ⬜ | Waiting for dispatch |
| in-progress | 🔄 | Agent is working |
| done | ✅ | Completed |
| failed | ❌ | Failed (pipeline blocks downstream) |
| skipped | ⏭️ | Intentionally skipped |

## Integration with OpenClaw

This tool is designed as an OpenClaw Skill. The orchestrating agent (AGI) dispatches tasks to worker agents via `sessions_send` and tracks state through the CLI.

### Dispatch Loop (Linear)

1. `next <project> --json` → get next stage info
2. `update <project> <agent> in-progress`
3. `sessions_send(agent, task)` → dispatch to agent
4. Wait for agent reply
5. `result <project> <agent> "..."` → save output
6. `update <project> <agent> done` → auto-advances to next stage
7. Repeat

### Dispatch Loop (DAG)

1. `ready <project> --json` → get ALL dispatchable tasks
2. For each ready task (parallel):
   a. `update <project> <task> in-progress`
   b. `sessions_send(agent, task + depOutputs)`
3. On reply: `result` → `update done` → check newly unblocked
4. Repeat until all tasks complete

## Common Pitfalls

### ⚠️ Linear mode: Stage ID = agent name, NOT a number

```bash
# ❌ WRONG — "stage '1' not found"
python3 scripts/task_manager.py assign my-project 1 "Build API"

# ✅ CORRECT
python3 scripts/task_manager.py assign my-project code-agent "Build API"
```

### ⚠️ DAG: Dependencies must exist before referencing

```bash
# ❌ WRONG — "dependency 'design' not found"
$TM add my-project implement -a code-agent -d "design"

# ✅ CORRECT — add deps first
$TM add my-project design -a docs-agent --desc "Write spec"
$TM add my-project implement -a code-agent -d "design" --desc "Implement"
```

### ⚠️ Debate: Cannot add debaters after rounds start

```bash
# ❌ WRONG
$TM round my-debate start
$TM add-debater my-debate new-agent  # Error!

# ✅ CORRECT — add all debaters before starting
$TM add-debater my-debate agent-a
$TM add-debater my-debate agent-b
$TM round my-debate start
```

## Data Storage

Project files are stored as JSON at:
```
/Users/shengchun.sun/.openclaw/workspace/data/team-tasks/<project>.json
```

Override with environment variable:
```bash
export TEAM_TASKS_DIR=/custom/path
```

## Examples

### Example 1: Linear Pipeline for Bug Fix

```bash
# Create project
python3 scripts/task_manager.py init fix-login-bug \
  -g "Fix login authentication bug" \
  -p "code-agent,test-agent,monitor-bot"

# Assign tasks
python3 scripts/task_manager.py assign fix-login-bug code-agent \
  "Fix SQL injection in login() function"
python3 scripts/task_manager.py assign fix-login-bug test-agent \
  "Add security tests for login"
python3 scripts/task_manager.py assign fix-login-bug monitor-bot \
  "Review fix and approve deployment"

# Execute pipeline
python3 scripts/task_manager.py next fix-login-bug
# ... dispatch to code-agent ...
python3 scripts/task_manager.py update fix-login-bug code-agent in-progress
# ... wait for completion ...
python3 scripts/task_manager.py result fix-login-bug code-agent "Fixed with parameterized queries"
python3 scripts/task_manager.py update fix-login-bug code-agent done
# ... auto-advances to test-agent ...
```

### Example 2: DAG for Feature Development

```bash
# Create DAG project
python3 scripts/task_manager.py init user-dashboard -m dag \
  -g "Build user dashboard with analytics"

# Add tasks with dependencies
python3 scripts/task_manager.py add user-dashboard api-design \
  -a docs-agent --desc "Design API endpoints"
python3 scripts/task_manager.py add user-dashboard db-schema \
  -a code-agent --desc "Design database schema"
python3 scripts/task_manager.py add user-dashboard backend \
  -a code-agent -d "api-design,db-schema" --desc "Implement backend API"
python3 scripts/task_manager.py add user-dashboard frontend \
  -a code-agent -d "api-design" --desc "Build React frontend"
python3 scripts/task_manager.py add user-dashboard integration \
  -a test-agent -d "backend,frontend" --desc "Integration tests"
python3 scripts/task_manager.py add user-dashboard docs \
  -a docs-agent -d "backend,frontend" --desc "Write user guide"

# Check ready tasks
python3 scripts/task_manager.py ready user-dashboard
# Both api-design and db-schema are ready (parallel dispatch!)
```

### Example 3: Debate for Architecture Decision

```bash
# Create debate
python3 scripts/task_manager.py init auth-strategy --mode debate \
  -g "Choose authentication strategy for microservices"

# Add debaters
python3 scripts/task_manager.py add-debater auth-strategy code-agent \
  --role "favor simplicity and maintainability"
python3 scripts/task_manager.py add-debater auth-strategy monitor-bot \
  --role "prioritize security and compliance"
python3 scripts/task_manager.py add-debater auth-strategy test-agent \
  --role "focus on testability and edge cases"

# Run debate
python3 scripts/task_manager.py round auth-strategy start
# ... collect positions ...
python3 scripts/task_manager.py round auth-strategy cross-review
# ... collect reviews ...
python3 scripts/task_manager.py round auth-strategy synthesize
```

## Installation

The skill is already installed at:
```
/Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/
```

To use the CLI tool:
```bash
python3 /Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/scripts/task_manager.py --help
```

Or add an alias:
```bash
alias tm='python3 /Users/shengchun.sun/.openclaw/workspace/skills/team-tasks/scripts/task_manager.py'
tm --help
```
