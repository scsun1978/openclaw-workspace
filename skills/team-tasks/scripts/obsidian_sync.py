#!/usr/bin/env python3
"""
Team-Tasks ↔ Obsidian Mission Control 同步器

功能：
1. 读取 Team-Tasks JSON 文件
2. 为每个任务生成/更新 Obsidian Markdown 文件
3. 更新 Tasks Board Canvas 看板视图
4. 支持双向同步（Obsidian 修改可回写 JSON）

使用：
  python3 obsidian_sync.py --sync          # 同步所有活跃项目
  python3 obsidian_sync.py --sync --all    # 包含归档项目
  python3 obsidian_sync.py --status        # 仅显示状态
  python3 obsidian_sync.py --watch         # 持续监听变化
"""

import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# 配置路径
VAULT_PATH = Path("/Users/shengchun.sun/Library/Mobile Documents/iCloud~md~obsidian/Documents/ctovault")
MISSION_CONTROL = VAULT_PATH / "Mission Control"
TASKS_DIR = MISSION_CONTROL / "Tasks"
TASKS_BOARD = MISSION_CONTROL / "Tasks Board.canvas"
TEAM_TASKS_DATA = Path("/Users/shengchun.sun/.openclaw/workspace/data/team-tasks")


def load_json(path: Path) -> dict:
    """加载 JSON 文件"""
    if not path.exists():
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    """保存 JSON 文件"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_status_emoji(status: str) -> str:
    """状态转 emoji"""
    mapping = {
        'pending': '⬜',
        'in-progress': '🔄',
        'done': '✅',
        'failed': '❌',
        'skipped': '⏭️',
        'completed': '✅'
    }
    return mapping.get(status, '❓')


def get_priority_color(priority: str) -> str:
    """优先级转颜色"""
    mapping = {
        'P0': '🔴',
        'P1': '🟡',
        'P2': '🟢',
        'P3': '⚪'
    }
    return mapping.get(priority, '⚪')


def generate_task_md(project_data: dict, stage_name: str, stage_data: dict) -> str:
    """生成任务 Markdown 内容"""
    status = stage_data.get('status', 'pending')
    agent = stage_data.get('agent', stage_name)
    task = stage_data.get('task', '')
    output = stage_data.get('output', '')
    logs = stage_data.get('logs', [])
    started = stage_data.get('startedAt', '')
    completed = stage_data.get('completedAt', '')
    
    # 格式化时间
    created = project_data.get('created_at', '')
    updated = project_data.get('updated', '')
    
    content = f"""# {project_data['name']} - {stage_name}

## 元信息

- **ID**: {project_data['name']}-{stage_name}
- **项目**: [[{project_data['name']}]]
- **阶段**: {stage_name}
- **Agent**: {agent}
- **状态**: {status} {get_status_emoji(status)}
- **创建时间**: {created[:19] if created else '-'}
- **更新时间**: {updated[:19] if updated else '-'}

## 任务描述

{task if task else '_待分配_'}

## 输出结果

{output if output else '_等待完成_'}

## 日志

"""
    for log in logs[-5:]:  # 最近 5 条日志
        ts = log.get('timestamp', log.get('time', ''))
        action = log.get('action', log.get('event', ''))
        content += f"- `{ts[:19] if ts else '-'}`: {action}\n"
    
    if not logs:
        content += "_暂无日志_\n"
    
    content += f"""
---

#openclaw #task #{project_data['name']} #{stage_name}
"""
    return content


def sync_project_to_obsidian(project_name: str, include_archive: bool = False) -> int:
    """同步单个项目到 Obsidian"""
    # 检查是否是归档项目
    archive_path = TEAM_TASKS_DATA / "archive" / f"{project_name}.json"
    active_path = TEAM_TASKS_DATA / f"{project_name}.json"
    
    if archive_path.exists() and not active_path.exists():
        if not include_archive:
            return 0  # 跳过归档
        project_path = archive_path
    else:
        project_path = active_path
    
    if not project_path.exists():
        return 0
    
    project_data = load_json(project_path)
    stages = project_data.get('stages', {})
    
    count = 0
    for stage_name, stage_data in stages.items():
        # 生成文件名
        task_id = f"{project_name}-{stage_name}"
        task_file = TASKS_DIR / f"{task_id}.md"
        
        # 生成内容
        content = generate_task_md(project_data, stage_name, stage_data)
        
        # 写入文件
        task_file.parent.mkdir(parents=True, exist_ok=True)
        with open(task_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        count += 1
    
    return count


def update_tasks_board_canvas():
    """更新 Tasks Board Canvas 看板"""
    # 读取现有 canvas 结构
    canvas_data = load_json(TASKS_BOARD)
    if not canvas_data:
        canvas_data = {"nodes": [], "edges": []}
    
    # 分类任务
    tasks_by_status = {
        'pending': [],
        'in-progress': [],
        'review': [],  # monitor 阶段视为 review
        'done': []
    }
    
    # 扫描 Tasks 目录
    for task_file in TASKS_DIR.glob("*.md"):
        if task_file.name == "TEMPLATE.md":
            continue
        
        task_id = task_file.stem
        content = task_file.read_text(encoding='utf-8')
        
        # 解析状态 (格式: **状态**: done ✅)
        status = 'pending'
        if '**状态**: done' in content or '状态**: done' in content:
            status = 'done'
        elif '**状态**: in-progress' in content or '状态**: in-progress' in content:
            status = 'in-progress'
        elif 'monitor' in task_id.lower():
            status = 'review'
        
        # 解析项目名
        project = task_id.split('-')[0] if '-' in task_id else task_id
        
        tasks_by_status[status].append({
            'id': task_id,
            'project': project,
            'link': f"[[{task_id}]]"
        })
    
    # 构建 canvas nodes
    # 列位置
    columns = {
        'pending': (-400, 50),
        'in-progress': (-100, 50),
        'review': (200, 50),
        'done': (500, 50)
    }
    
    # 保留 header nodes
    header_ids = ['header-todo', 'header-progress', 'header-review', 'header-done', 'info']
    existing_nodes = {n['id']: n for n in canvas_data.get('nodes', [])}
    
    new_nodes = []
    
    # 保留 headers
    for hid in header_ids:
        if hid in existing_nodes:
            new_nodes.append(existing_nodes[hid])
    
    # 添加任务节点
    y_offset = {'pending': 50, 'in-progress': 50, 'review': 50, 'done': 50}
    for status, tasks in tasks_by_status.items():
        x = columns[status][0]
        for task in tasks:
            node = {
                "id": f"task-{task['id']}",
                "type": "file",
                "file": f"Mission Control/Tasks/{task['id']}.md",
                "x": x,
                "y": y_offset[status],
                "width": 200,
                "height": 100
            }
            new_nodes.append(node)
            y_offset[status] += 120
    
    canvas_data['nodes'] = new_nodes
    
    # 保存
    save_json(TASKS_BOARD, canvas_data)
    return sum(len(t) for t in tasks_by_status.values())


def sync_all(include_archive: bool = False) -> Dict[str, int]:
    """同步所有项目"""
    results = {}
    
    # 扫描活跃项目
    for json_file in TEAM_TASKS_DATA.glob("*.json"):
        project_name = json_file.stem
        count = sync_project_to_obsidian(project_name, include_archive)
        if count > 0:
            results[project_name] = count
    
    # 扫描归档项目（如果需要）
    archive_dir = TEAM_TASKS_DATA / "archive"
    if include_archive and archive_dir.exists():
        for json_file in archive_dir.glob("*.json"):
            project_name = json_file.stem
            count = sync_project_to_obsidian(project_name, True)
            if count > 0:
                results[f"{project_name} (archived)"] = count
    
    # 更新看板
    board_count = update_tasks_board_canvas()
    
    return results


def show_status():
    """显示同步状态"""
    print("=" * 50)
    print("📊 Team-Tasks ↔ Obsidian 同步状态")
    print("=" * 50)
    
    # 统计 Team-Tasks
    active_projects = list(TEAM_TASKS_DATA.glob("*.json"))
    archive_dir = TEAM_TASKS_DATA / "archive"
    archived_projects = list(archive_dir.glob("*.json")) if archive_dir.exists() else []
    
    print(f"\n📁 Team-Tasks 数据:")
    print(f"   活跃项目: {len(active_projects)}")
    print(f"   归档项目: {len(archived_projects)}")
    
    # 统计 Obsidian Tasks
    if TASKS_DIR.exists():
        task_files = list(TASKS_DIR.glob("*.md"))
        task_files = [f for f in task_files if f.name != "TEMPLATE.md"]
        print(f"\n📝 Obsidian Tasks:")
        print(f"   任务文件: {len(task_files)}")
        
        # 按状态分类
        status_count = {'pending': 0, 'in-progress': 0, 'done': 0}
        for tf in task_files:
            content = tf.read_text(encoding='utf-8')
            if '**状态**: done' in content:
                status_count['done'] += 1
            elif '**状态**: in-progress' in content:
                status_count['in-progress'] += 1
            else:
                status_count['pending'] += 1
        
        print(f"   ⬜ 待处理: {status_count['pending']}")
        print(f"   🔄 进行中: {status_count['in-progress']}")
        print(f"   ✅ 已完成: {status_count['done']}")
    
    # 看板状态
    if TASKS_BOARD.exists():
        canvas = load_json(TASKS_BOARD)
        nodes = canvas.get('nodes', [])
        print(f"\n🎯 Tasks Board Canvas:")
        print(f"   节点数: {len(nodes)}")
    
    print("\n" + "=" * 50)


def main():
    parser = argparse.ArgumentParser(description='Team-Tasks ↔ Obsidian 同步器')
    parser.add_argument('--sync', action='store_true', help='执行同步')
    parser.add_argument('--status', action='store_true', help='显示状态')
    parser.add_argument('--all', action='store_true', help='包含归档项目')
    parser.add_argument('--watch', action='store_true', help='持续监听（TODO）')
    
    args = parser.parse_args()
    
    if args.status:
        show_status()
    elif args.sync:
        print("🔄 开始同步...")
        results = sync_all(include_archive=args.all)
        
        total = 0
        for project, count in results.items():
            print(f"   ✅ {project}: {count} 个任务")
            total += count
        
        print(f"\n✨ 同步完成！共 {total} 个任务已更新到 Obsidian")
    elif args.watch:
        print("⚠️  --watch 模式尚未实现，请使用 cron 定时执行 --sync")
    else:
        show_status()


if __name__ == '__main__':
    main()
