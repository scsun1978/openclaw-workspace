#!/usr/bin/env python3
"""
Mission Control 数据桥接器
从 OpenClaw 导出的状态文件中读取真实数据
"""

import json
import os
import glob
from datetime import datetime
from pathlib import Path

# 配置
WORKSPACE = Path("/Users/shengchun.sun/.openclaw/workspace")
VAULT_PATH = Path("/Users/shengchun.sun/Library/Mobile Documents/iCloud~md~obsidian/Documents/ctovault")
MISSION_CONTROL = VAULT_PATH / "Mission Control"

# 状态导出文件
EXPORT_DIR = WORKSPACE / "mission-control-export"
CRON_EXPORT = EXPORT_DIR / "cron-status.json"
SESSIONS_EXPORT = EXPORT_DIR / "sessions-status.json"
SUBAGENTS_EXPORT = EXPORT_DIR / "subagents-status.json"
MEMORY_INDEX = EXPORT_DIR / "memory-index.json"

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
    """索引所有 memory 文件"""
    memory_dir = WORKSPACE / "memory"
    index = {
        "files": [],
        "last_update": datetime.now().isoformat(),
        "total_files": 0
    }
    
    if memory_dir.exists():
        for md_file in sorted(memory_dir.glob("*.md"), reverse=True):
            stat = md_file.stat()
            index["files"].append({
                "name": md_file.name,
                "path": str(md_file.relative_to(WORKSPACE)),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        index["total_files"] = len(index["files"])
    
    write_json(MEMORY_INDEX, index)
    return index

def generate_memory_canvas():
    """生成 Memory Canvas"""
    index = read_json(MEMORY_INDEX, {"files": []})
    
    nodes = [
        {
            "id": "title",
            "type": "text",
            "text": "# 🧠 Memory\n\n可搜索的记忆库",
            "x": 0,
            "y": -400,
            "width": 400,
            "height": 100
        }
    ]
    
    # 长期记忆
    nodes.append({
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
        "x": -400,
        "y": -200,
        "width": 350,
        "height": 280,
        "color": "6"
    })
    
    # 最近记忆文件
    recent_files = index.get("files", [])[:8]
    y_pos = -200
    for i, f in enumerate(recent_files):
        nodes.append({
            "id": f"mem-{i}",
            "type": "text",
            "text": f"""### 📄 {f['name']}

大小: {f['size']} bytes
修改: {f['modified'][:10]}""",
            "x": 100,
            "y": y_pos,
            "width": 300,
            "height": 100,
            "color": "4" if i == 0 else "0"
        })
        y_pos += 120
    
    # 统计
    nodes.append({
        "id": "stats",
        "type": "text",
        "text": f"""## 📊 统计

- **总计**: {index.get('total_files', 0)} 个文件
- **最近更新**: {index.get('last_update', 'N/A')[:16]}

---
目录: `memory/`""",
        "x": 450,
        "y": -200,
        "width": 300,
        "height": 180,
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
    
    # 生成 Memory Canvas
    generate_memory_canvas()
    
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
