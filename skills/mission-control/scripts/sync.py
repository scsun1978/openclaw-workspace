#!/usr/bin/env python3
"""
Mission Control 同步脚本
从 OpenClaw 工作流提取数据，更新 Obsidian Canvas
"""

import json
import os
import glob
from datetime import datetime
from pathlib import Path

# 配置
VAULT_PATH = Path("/Users/shengchun.sun/Library/Mobile Documents/iCloud~md~obsidian/Documents/ctovault")
MISSION_CONTROL = VAULT_PATH / "Mission Control"
TASKS_DIR = MISSION_CONTROL / "Tasks"
WORKSPACE = Path("/Users/shengchun.sun/.openclaw/workspace")

# 真实任务数据目录 (team-tasks skill)
TEAM_TASKS_DIR = WORKSPACE / "data" / "team-tasks"

# Canvas 颜色
COLORS = {
    "red": "1",
    "orange": "2", 
    "yellow": "3",
    "green": "4",
    "blue": "5",
    "purple": "6"
}

def read_team_tasks():
    """读取所有 team-tasks 项目"""
    tasks = []
    if TEAM_TASKS_DIR.exists():
        for json_file in TEAM_TASKS_DIR.glob("*.json"):
            try:
                with open(json_file) as f:
                    data = json.load(f)
                    project_id = json_file.stem
                    project_name = data.get("name", project_id)
                    project_status = data.get("status", "unknown")
                    
                    for stage_id, stage_info in data.get("stages", {}).items():
                        # 统一状态映射
                        raw_status = stage_info.get("status", "unknown").lower()
                        if raw_status in ["done", "completed"]:
                            status = "done"
                        elif raw_status in ["in-progress", "running", "active"]:
                            status = "in-progress"
                        elif raw_status in ["todo", "pending", "waiting"]:
                            status = "todo"
                        elif raw_status in ["failed", "error"]:
                            status = "review"  # 需要审查
                        else:
                            status = "todo"
                        
                        tasks.append({
                            "project": project_name,
                            "project_id": project_id,
                            "stage": stage_id,
                            "status": status,
                            "agent": stage_info.get("agent", "unknown"),
                            "last_update": stage_info.get("completed_at") or stage_info.get("updated_at") or data.get("updated_at", ""),
                            "notes": stage_info.get("notes") or stage_info.get("output") or stage_info.get("task", ""),
                            "output": stage_info.get("output", ""),
                            "task": stage_info.get("task", "")
                        })
            except Exception as e:
                print(f"Error reading {json_file}: {e}")
    return tasks

def read_cron_jobs():
    """读取 cron jobs (模拟 - 实际需要调用 cron API)"""
    cron_file = WORKSPACE / "cron-state.json"
    if cron_file.exists():
        with open(cron_file) as f:
            return json.load(f)
    return []

def generate_tasks_canvas(tasks):
    """生成 Tasks Board Canvas - 简洁清晰的卡片布局"""
    # 按状态分组
    grouped = {
        "todo": [],
        "in-progress": [],
        "review": [],
        "done": []
    }
    
    for task in tasks:
        status = task.get("status", "todo")
        if status in grouped:
            grouped[status].append(task)
        elif status == "waiting":
            grouped["todo"].append(task)
        else:
            grouped["in-progress"].append(task)
    
    nodes = []
    edges = []
    
    # 列头
    columns = [
        ("todo", "📋 To Do", -700, COLORS["red"]),
        ("in-progress", "🔄 In Progress", -200, COLORS["yellow"]),
        ("review", "👀 Review", 300, COLORS["orange"]),
        ("done", "✅ Done", 800, COLORS["green"])
    ]
    
    for status, title, x, color in columns:
        count = len(grouped[status])
        nodes.append({
            "id": f"header-{status}",
            "type": "text",
            "text": f"# {title}\n\n{count} 个任务",
            "x": x,
            "y": -300,
            "width": 400,
            "height": 80,
            "color": color
        })
    
    # 任务节点 - 简洁布局
    y_offset = -100
    y_spacing = 180  # 减少间距
    for status, _, x, _ in columns:
        y = y_offset
        for task in grouped[status]:
            task_id = f"{task['project_id']}-{task['stage']}"
            
            # 状态图标
            status_icons = {"todo": "⬜", "in-progress": "🔄", "review": "👀", "done": "✅"}
            icon = status_icons.get(status, "❓")
            
            # 获取任务描述和输出
            task_desc = task.get('task', '') or task.get('notes', '') or '无描述'
            output = task.get('output', '')
            
            # 构建卡片内容 - 更简洁，减少行数
            if output and status == "done":
                card_text = f"""# {icon} {task['project']}

**任务**: {task_desc[:50]}
**结果**: {output[:60]}{'...' if len(output) > 60 else ''}

`{task['stage']}`"""
            else:
                card_text = f"""# {icon} {task['project']}

**任务**: {task_desc[:60]}

`{task['stage']}`"""
            
            nodes.append({
                "id": f"task-{task_id}",
                "type": "text",
                "text": card_text,
                "x": x,
                "y": y,
                "width": 380,
                "height": 160,  # 减少高度
                "color": "0"
            })
            y += y_spacing
    
    # 统计
    nodes.append({
        "id": "stats",
        "type": "text",
        "text": f"""# 📊 统计

总计: {len(tasks)} | To Do: {len(grouped['todo'])} | Done: {len(grouped['done'])}

---
{datetime.now().strftime('%Y-%m-%d %H:%M')}""",
        "x": -700,
        "y": 600,
        "width": 400,
        "height": 120,
        "color": COLORS["blue"]
    })
    
    return {"nodes": nodes, "edges": edges}

def generate_team_canvas(tasks):
    """生成 Team Canvas - 优化布局"""
    # 统计各 agent 的任务（规范化 agent 名称）
    agent_tasks = {}
    for task in tasks:
        # 规范化 agent 名称
        raw_agent = task.get("agent", "unknown")
        if "code" in raw_agent.lower():
            agent = "code-agent"
        elif "docs" in raw_agent.lower():
            agent = "docs-agent"
        elif "qa" in raw_agent.lower() or "test" in raw_agent.lower():
            agent = "qa-agent"
        elif "monitor" in raw_agent.lower():
            agent = "monitor-agent"
        else:
            agent = raw_agent
        
        if agent not in agent_tasks:
            agent_tasks[agent] = {"tasks": [], "statuses": set()}
        agent_tasks[agent]["tasks"].append(task)
        agent_tasks[agent]["statuses"].add(task.get("status", "unknown"))
    
    nodes = [
        {
            "id": "title",
            "type": "text",
            "text": "# 🤖 Agent Team\n\nMission Control 实时状态",
            "x": 0,
            "y": -400,
            "width": 400,
            "height": 100
        }
    ]
    edges = []
    
    # Agent 定义 - 增大间距
    agents = [
        {
            "id": "monitor-agent",
            "name": "📊 Monitor Agent",
            "desc": "监控进度与风险",
            "x": -450, "y": -150,
            "color": COLORS["red"]
        },
        {
            "id": "code-agent",
            "name": "💻 Code Agent",
            "desc": "代码开发与重构",
            "x": 0, "y": -150,
            "color": COLORS["green"]
        },
        {
            "id": "docs-agent",
            "name": "📝 Docs Agent",
            "desc": "文档编写与维护",
            "x": 450, "y": -150,
            "color": COLORS["blue"]
        },
        {
            "id": "qa-agent",
            "name": "🧪 QA Agent",
            "desc": "测试验证与质量保障",
            "x": -225, "y": 250,
            "color": COLORS["yellow"]
        }
    ]
    
    for agent in agents:
        agent_id = agent["id"]
        task_info = agent_tasks.get(agent_id, {"tasks": [], "statuses": set()})
        task_count = len(task_info["tasks"])
        statuses = task_info["statuses"]
        
        # 确定状态
        if "in-progress" in statuses:
            status_text = "🟢 运行中"
            status_color = COLORS["green"]
        elif "error" in statuses:
            status_text = "🔴 错误"
            status_color = COLORS["red"]
        elif task_count > 0:
            status_text = "🟡 有任务"
            status_color = COLORS["yellow"]
        else:
            status_text = "⚪ 空闲"
            status_color = "0"
        
        task_list = "\n".join([f"- `{t['project']}/{t['stage']}`" for t in task_info["tasks"][:3]])
        if task_count > 3:
            task_list += f"\n- ... +{task_count - 3} more"
        
        nodes.append({
            "id": f"agent-{agent_id}",
            "type": "text",
            "text": f"""## {agent["name"]}

{agent["desc"]}

**状态**: {status_text}
**任务数**: {task_count}

### 当前任务
{task_list if task_list else "_暂无任务_"}""",
            "x": agent["x"],
            "y": agent["y"],
            "width": 400,
            "height": 280,
            "color": agent["color"]
        })
        
        # 连接到主节点
        edges.append({
            "id": f"edge-{agent_id}",
            "fromNode": "title",
            "toNode": f"agent-{agent_id}",
            "fromSide": "bottom",
            "toSide": "top"
        })
    
    # 同步时间
    nodes.append({
        "id": "sync-time",
        "type": "text",
        "text": f"⏰ 同步时间\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "x": 450,
        "y": 350,
        "width": 300,
        "height": 80,
        "color": "0"
    })
    
    return {"nodes": nodes, "edges": edges}

def write_canvas(name, data):
    """写入 Canvas 文件"""
    canvas_path = MISSION_CONTROL / f"{name}.canvas"
    with open(canvas_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"✅ Updated {name}.canvas")

def main():
    print("🎛️ Mission Control Sync")
    print("=" * 40)
    
    # 读取数据
    tasks = read_team_tasks()
    print(f"📋 Found {len(tasks)} tasks")
    
    # 生成并写入 Canvas
    if tasks:
        write_canvas("Tasks Board", generate_tasks_canvas(tasks))
        write_canvas("Team", generate_team_canvas(tasks))
    else:
        print("⚠️ No tasks found, skipping canvas update")
    
    print("=" * 40)
    print("✨ Sync complete")

if __name__ == "__main__":
    main()
