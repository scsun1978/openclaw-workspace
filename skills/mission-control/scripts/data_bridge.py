#!/usr/bin/env python3
"""
Mission Control 数据桥接器
从 OpenClaw 导出的状态文件中读取真实数据
"""

import json
import os
import re
import subprocess
import glob
from datetime import datetime
from pathlib import Path

# 配置
WORKSPACE = Path("/Users/shengchun.sun/.openclaw/workspace")
VAULT_PATH = Path("/Users/shengchun.sun/Library/Mobile Documents/iCloud~md~obsidian/Documents/ctovault")
MISSION_CONTROL = VAULT_PATH / "Mission Control"

# Agent 定义
AGENTS = [
    {"id": "scsun-monitor-agent", "name": "Monitor", "emoji": "🔍", "role": "监控与协调"},
    {"id": "scsun-code-agent", "name": "Code", "emoji": "💻", "role": "代码实现"},
    {"id": "scsun-docs-agent", "name": "Docs", "emoji": "📝", "role": "文档编写"},
    {"id": "scsun-qa-agent", "name": "QA", "emoji": "🧪", "role": "质量测试"},
]

# 状态导出文件
EXPORT_DIR = WORKSPACE / "mission-control-export"
CRON_EXPORT = EXPORT_DIR / "cron-status.json"
SESSIONS_EXPORT = EXPORT_DIR / "sessions-status.json"
SUBAGENTS_EXPORT = EXPORT_DIR / "subagents-status.json"
MEMORY_INDEX = EXPORT_DIR / "memory-index.json"
AGENT_MEMORY_EXPORT = EXPORT_DIR / "agent-memory-status.json"

def ensure_export_dir():
    """确保导出目录存在"""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    return EXPORT_DIR

def read_json(path, default=None):
    """安全读取 JSON 文件"""
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except:
            pass
    return default or {}

def write_json(path, data):
    """写入 JSON 文件"""
    ensure_export_dir()
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def index_memory_files():
    """索引所有 memory 文件（递归扫描子目录）"""
    memory_dir = WORKSPACE / "memory"
    index = {
        "files": [],
        "last_update": datetime.now().isoformat(),
        "total_files": 0,
        "categories": {
            "daily": [],
            "stats": [],
            "index": []
        }
    }
    
    if memory_dir.exists():
        # 扫描根目录
        for md_file in sorted(memory_dir.glob("*.md"), reverse=True):
            stat = md_file.stat()
            file_info = {
                "name": md_file.name,
                "path": str(md_file.relative_to(WORKSPACE)),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "category": "index"
            }
            index["files"].append(file_info)
            index["categories"]["index"].append(file_info)
        
        # 递归扫描子目录
        for md_file in sorted(memory_dir.rglob("*.md"), reverse=True):
            if md_file.parent == memory_dir:
                continue  # 跳过根目录（已处理）
            
            stat = md_file.stat()
            rel_path = str(md_file.relative_to(WORKSPACE))
            
            # 根据路径确定分类
            if "archive/daily" in rel_path:
                category = "daily"
            elif "archive/stats" in rel_path:
                category = "stats"
            else:
                category = "other"
            
            file_info = {
                "name": md_file.name,
                "path": rel_path,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "category": category
            }
            index["files"].append(file_info)
            if category in index["categories"]:
                index["categories"][category].append(file_info)
        
        index["total_files"] = len(index["files"])
    
    write_json(MEMORY_INDEX, index)
    return index

def get_agent_memory_status():
    """获取所有 Agent 的 Memory 状态"""
    agent_status = []
    
    try:
        result = subprocess.run(
            ["openclaw", "memory", "status"],
            capture_output=True,
            text=True,
            timeout=30
        )
        output = result.stdout
        
        # 解析每个 agent 的状态
        current_agent = None
        agent_data = {}
        
        for line in output.split('\n'):
            line = line.strip()
            
            # 检测 agent 名称
            if line.startswith('Memory Search ('):
                if current_agent and agent_data:
                    agent_status.append(agent_data)
                agent_name = re.search(r'Memory Search \(([^)]+)\)', line)
                current_agent = agent_name.group(1) if agent_name else None
                agent_data = {
                    "agent_id": current_agent,
                    "name": current_agent.replace("scsun-", "").replace("-agent", "").title(),
                    "indexed_files": 0,
                    "total_files": 0,
                    "chunks": 0,
                    "memory_files": 0,
                    "session_files": 0,
                    "embedding_model": "",
                    "status": "unknown"
                }
            
            elif current_agent:
                # 解析索引信息: "Indexed: 528/1945 files · 2790 chunks"
                if line.startswith('Indexed:'):
                    match = re.search(r'Indexed: (\d+)/(\d+) files · (\d+) chunks', line)
                    if match:
                        agent_data["indexed_files"] = int(match.group(1))
                        agent_data["total_files"] = int(match.group(2))
                        agent_data["chunks"] = int(match.group(3))
                
                # 解析 memory 来源
                elif 'memory ·' in line:
                    match = re.search(r'memory · (\d+)/(\d+) files', line)
                    if match:
                        agent_data["memory_files"] = int(match.group(1))
                
                # 解析 sessions 来源
                elif 'sessions ·' in line:
                    match = re.search(r'sessions · (\d+)/(\d+) files', line)
                    if match:
                        agent_data["session_files"] = int(match.group(1))
                
                # 解析 embedding model
                elif line.startswith('Model:'):
                    agent_data["embedding_model"] = line.replace('Model:', '').strip()
                
                # 检测向量状态
                elif line.startswith('Vector:'):
                    agent_data["status"] = "ready" if "ready" in line else "error"
        
        # 添加最后一个 agent
        if current_agent and agent_data:
            agent_status.append(agent_data)
    
    except Exception as e:
        print(f"⚠️ Failed to get agent memory status: {e}")
    
    # 保存到文件
    write_json(AGENT_MEMORY_EXPORT, {
        "agents": agent_status,
        "last_update": datetime.now().isoformat()
    })
    
    return agent_status

def generate_memory_canvas(agent_status=None):
    """生成 Memory Canvas（支持分类显示 + Agent 记忆分析）"""
    index = read_json(MEMORY_INDEX, {"files": [], "categories": {}})
    
    nodes = [
        {
            "id": "title",
            "type": "text",
            "text": "# 🧠 Memory\n\n可搜索的记忆库",
            "x": 0,
            "y": -600,
            "width": 400,
            "height": 100
        },
        {
            "id": "long-term",
            "type": "text",
            "text": """## 📚 长期记忆

**文件**: `MEMORY.md`

存储内容:
- 重要决策
- 项目里程碑
- 经验教训
- 偏好设置

---
搜索: `memory_search "关键词"`""",
            "x": -600,
            "y": -400,
            "width": 350,
            "height": 280,
            "color": "6"
        }
    ]
    
    # 索引文件（MEMORY-INDEX.md）
    index_files = index.get("categories", {}).get("index", [])
    if index_files:
        for i, f in enumerate(index_files[:2]):
            nodes.append({
                "id": f"idx-{i}",
                "type": "text",
                "text": f"""### 📋 {f['name']}

大小: {f['size']} bytes
修改: {f['modified'][:10]}""",
                "x": -200,
                "y": -400 + i * 120,
                "width": 300,
                "height": 100,
                "color": "4"
            })
    
    # 每日日志
    daily_files = index.get("categories", {}).get("daily", [])
    if daily_files:
        daily_node = {
            "id": "daily-title",
            "type": "text",
            "text": f"## 📅 每日日志\n\n共 {len(daily_files)} 个文件",
            "x": 150,
            "y": -400,
            "width": 200,
            "height": 80,
            "color": "3"
        }
        nodes.append(daily_node)
        
        y_pos = -280
        for i, f in enumerate(daily_files[:4]):
            nodes.append({
                "id": f"daily-{i}",
                "type": "text",
                "text": f"📄 {f['name'][:16]}\n{f['size']} bytes",
                "x": 150,
                "y": y_pos,
                "width": 180,
                "height": 60,
                "color": "0"
            })
            y_pos += 70
    
    # Agent 记忆分析
    if agent_status:
        # Agent 区域标题
        nodes.append({
            "id": "agents-title",
            "type": "text",
            "text": "## 🤖 Agent 记忆分析\n\n各 Agent 的记忆存储状态",
            "x": -600,
            "y": -50,
            "width": 400,
            "height": 100,
            "color": "5"
        })
        
        # 各 Agent 节点
        agent_colors = {"Monitor": "4", "Code": "3", "Docs": "2", "Qa": "1"}
        x_positions = [-600, -200, 200, 600]
        
        for i, agent in enumerate(agent_status[:4]):
            name = agent.get("name", "Unknown")
            chunks = agent.get("chunks", 0)
            indexed = agent.get("indexed_files", 0)
            total = agent.get("total_files", 0)
            mem_files = agent.get("memory_files", 0)
            sess_files = agent.get("session_files", 0)
            status = agent.get("status", "unknown")
            
            # 根据 chunks 数量决定状态颜色
            if chunks > 1000:
                status_emoji = "🟢"
                color = "4"
            elif chunks > 100:
                status_emoji = "🟡"
                color = "3"
            elif chunks > 0:
                status_emoji = "🟠"
                color = "1"
            else:
                status_emoji = "⚪"
                color = "0"
            
            # Agent emoji
            agent_emoji = {"Monitor": "🔍", "Code": "💻", "Docs": "📝", "Qa": "🧪"}.get(name, "🤖")
            role = {"Monitor": "监控", "Code": "代码", "Docs": "文档", "Qa": "测试"}.get(name, "")
            
            nodes.append({
                "id": f"agent-{i}",
                "type": "text",
                "text": f"""### {status_emoji} {agent_emoji} {name}

**角色**: {role}
**Chunks**: {chunks:,}
**文件**: {indexed}/{total}
- Memory: {mem_files}
- Sessions: {sess_files}

**状态**: {status}""",
                "x": x_positions[i] if i < len(x_positions) else -600 + i * 400,
                "y": 100,
                "width": 350,
                "height": 220,
                "color": color
            })
    
    # 总统计
    total_chunks = sum(a.get("chunks", 0) for a in (agent_status or []))
    total_indexed = sum(a.get("indexed_files", 0) for a in (agent_status or []))
    
    nodes.append({
        "id": "stats",
        "type": "text",
        "text": f"""## 📊 总体统计

**文件系统**
- **总计**: {index.get('total_files', 0)} 个文件
- **索引**: {len(index_files)}
- **日志**: {len(daily_files)}

**Agent 记忆**
- **总 Chunks**: {total_chunks:,}
- **总索引文件**: {total_indexed}

---
更新: {datetime.now().strftime('%Y-%m-%d %H:%M')}""",
        "x": 400,
        "y": 100,
        "width": 350,
        "height": 280,
        "color": "5"
    })
    
    canvas = {"nodes": nodes, "edges": []}
    canvas_path = MISSION_CONTROL / "Memory.canvas"
    with open(canvas_path, "w") as f:
        json.dump(canvas, f, indent=2)
    print(f"✅ Updated Memory.canvas ({len(nodes)} nodes)")

def format_schedule(job):
    """格式化调度信息"""
    schedule = job.get("schedule", {})
    kind = schedule.get("kind", "unknown")
    
    if kind == "every":
        every_ms = schedule.get("everyMs", 0)
        if every_ms >= 3600000:
            return f"每 {every_ms // 3600000} 小时"
        elif every_ms >= 60000:
            return f"每 {every_ms // 60000} 分钟"
        else:
            return f"每 {every_ms // 1000} 秒"
    elif kind == "cron":
        return f"Cron: {schedule.get('expr', 'unknown')}"
    elif kind == "at":
        return "一次性任务"
    return "unknown"

def format_next_run(job):
    """格式化下次运行时间"""
    state = job.get("state", {})
    next_ms = state.get("nextRunAtMs")
    if next_ms:
        return datetime.fromtimestamp(next_ms / 1000).strftime('%Y-%m-%d %H:%M')
    return "N/A"

def generate_calendar_canvas(cron_data):
    """生成 Calendar Canvas"""
    nodes = [
        {
            "id": "title",
            "type": "text",
            "text": "# 📅 Calendar\n\nCron Jobs & Scheduled Tasks",
            "x": 0,
            "y": -400,
            "width": 400,
            "height": 100
        }
    ]
    
    jobs = cron_data.get("jobs", [])
    
    # 活跃任务
    active_jobs = [j for j in jobs if j.get("enabled")]
    
    y_pos = -200
    for i, job in enumerate(active_jobs[:6]):
        name = job.get("name", "unknown")
        state = job.get("state", {})
        status = state.get("lastStatus", "unknown")
        schedule_str = format_schedule(job)
        next_run = format_next_run(job)
        
        status_emoji = "✅" if status == "ok" else "❌" if status == "error" else "⏳"
        
        nodes.append({
            "id": f"job-{i}",
            "type": "text",
            "text": f"""## {status_emoji} {name}

**状态**: {status}
**频率**: {schedule_str}
**下次**: {next_run}""",
            "x": -300 if i % 2 == 0 else 100,
            "y": y_pos + (i // 2) * 200,
            "width": 380,
            "height": 160,
            "color": "4" if status == "ok" else "1" if status == "error" else "3"
        })
    
    # 统计
    ok_count = len([j for j in active_jobs if j.get("state", {}).get("lastStatus") == "ok"])
    error_count = len([j for j in active_jobs if j.get("state", {}).get("lastStatus") == "error"])
    
    nodes.append({
        "id": "stats",
        "type": "text",
        "text": f"""## 📊 统计

- **总任务**: {len(jobs)}
- **已启用**: {len(active_jobs)}
- **运行中**: {ok_count}
- **错误**: {error_count}

---
同步: {datetime.now().strftime('%Y-%m-%d %H:%M')}""",
        "x": 0,
        "y": 400,
        "width": 400,
        "height": 200,
        "color": "5"
    })
    
    canvas = {"nodes": nodes, "edges": []}
    canvas_path = MISSION_CONTROL / "Calendar.canvas"
    with open(canvas_path, "w") as f:
        json.dump(canvas, f, indent=2)
    print(f"✅ Updated Calendar.canvas ({len(nodes)} nodes)")

def main():
    print("🌉 Mission Control Data Bridge")
    print("=" * 50)
    
    # 索引 memory 文件
    mem_index = index_memory_files()
    print(f"📚 Indexed {mem_index['total_files']} memory files")
    
    # 获取 Agent Memory 状态
    agent_status = get_agent_memory_status()
    print(f"🤖 Analyzed {len(agent_status)} agents memory")
    for agent in agent_status:
        print(f"   - {agent['name']}: {agent['chunks']} chunks")
    
    # 生成 Memory Canvas (包含 Agent 分析)
    generate_memory_canvas(agent_status)
    
    # 读取 cron 数据（需要先导出）
    cron_data = read_json(CRON_EXPORT, {"jobs": []})
    if cron_data.get("jobs"):
        generate_calendar_canvas(cron_data)
        print(f"📅 Processed {len(cron_data['jobs'])} cron jobs")
    else:
        print("⚠️ No cron data found. Run export first.")
    
    print("=" * 50)
    print("✨ Bridge complete")

if __name__ == "__main__":
    main()
