#!/usr/bin/env python3
"""
Task Coordinator - 自动协调 Team-Tasks 项目

功能：
1. 检查所有项目状态
2. 发现停滞的任务
3. 自动推送到对应 agent
4. 记录推送日志
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# 配置
PROJECTS_DIR = Path("/Users/shengchun.sun/.openclaw/workspace/data/team-tasks")
LOGS_DIR = Path("/Users/shengchun.sun/.openclaw/workspace/logs")
CONFIG_FILE = Path(__file__).parent.parent / "config.json"

# Agent 会话映射（兼容 team-tasks 默认 agent 命名）
AGENTS = {
    "code-agent": "agent:scsun-code-agent:telegram:group:-5107037842",
    "test-agent": "agent:scsun-qa-agent:telegram:group:-5294088642",  # team-tasks 默认
    "qa-agent": "agent:scsun-qa-agent:telegram:group:-5294088642",    # 本地兼容
    "docs-agent": "agent:scsun-docs-agent:telegram:group:-5277020999",
    "monitor-bot": "agent:scsun-monitor-agent:telegram:group:-5186938821",   # team-tasks 默认
    "monitor-agent": "agent:scsun-monitor-agent:telegram:group:-5186938821"   # 本地兼容
}

# 超时阈值（分钟）
DEFAULT_TIMEOUT = 10
TIMEOUT_THRESHOLDS = {
    "code-agent": 15,
    "test-agent": 10,
    "qa-agent": 10,
    "docs-agent": 10,
    "monitor-bot": 5,
    "monitor-agent": 5
}

# 推送策略
MAX_PUSH_ATTEMPTS = 3
BACKOFF_MINUTES = 5
# 去重冷却（同一 project/stage 在该时间内不重复推送）
PUSH_COOLDOWN_MINUTES = 15


def ensure_logs_dir():
    """确保日志目录存在"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


def get_log_file() -> Path:
    """获取当天的日志文件"""
    ensure_logs_dir()
    date_str = datetime.now().strftime("%Y-%m-%d")
    return LOGS_DIR / f"coordinator-{date_str}.json"


def write_log(log_entry: Dict):
    """写入日志"""
    log_file = get_log_file()
    
    # 读取现有日志
    logs = []
    if log_file.exists():
        with open(log_file, 'r') as f:
            try:
                logs = json.load(f)
            except:
                logs = []
    
    # 添加新日志
    logs.append(log_entry)
    
    # 写回文件
    with open(log_file, 'w') as f:
        json.dump(logs, f, indent=2)


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # 兼容 Z 结尾
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except Exception:
        return None


def normalize_agent_name(agent: str) -> str:
    """把本地命名归一到 team-tasks 常见 agent id。"""
    if not agent:
        return agent
    name = agent.strip().lower()
    alias = {
        'scsun-code-agent': 'code-agent',
        'scsun-qa-agent': 'qa-agent',
        'scsun-test-agent': 'test-agent',
        'scsun-docs-agent': 'docs-agent',
        'scsun-monitor-agent': 'monitor-agent',
    }
    return alias.get(name, name)


def get_last_log_time(stage: Dict) -> Optional[datetime]:
    """获取最后活动时间（兼容旧/新 team-tasks 结构）"""
    logs = stage.get('logs') or []
    if logs:
        last_log = logs[-1]
        # 新版使用 time，旧版可能用 timestamp
        dt = parse_iso_datetime(last_log.get('time') or last_log.get('timestamp'))
        if dt:
            return dt

    # 兜底：用 startedAt / completedAt
    return parse_iso_datetime(stage.get('startedAt') or stage.get('completedAt'))


def check_project(project_file: Path) -> Optional[Dict]:
    """检查单个项目状态（兼容 linear / dag）"""
    try:
        with open(project_file, 'r') as f:
            project = json.load(f)

        # 新版字段是 project，旧版可能是 name
        project_name = project.get('project') or project.get('name') or project_file.stem
        stages = project.get('stages', {})

        for stage_name, stage in stages.items():
            status = stage.get('status')

            # 只检查 pending 或 in-progress 的阶段
            if status not in ['pending', 'in-progress']:
                continue

            # agent 优先使用 stage.agent（DAG/新版本），否则回退 stage_name
            agent_name = normalize_agent_name(stage.get('agent') or stage_name)

            last_log_time = get_last_log_time(stage)
            if not last_log_time:
                continue

            now = datetime.now(last_log_time.tzinfo) if last_log_time.tzinfo else datetime.now()
            stuck_duration = now - last_log_time
            stuck_minutes = stuck_duration.total_seconds() / 60

            timeout = TIMEOUT_THRESHOLDS.get(agent_name, TIMEOUT_THRESHOLDS.get(stage_name, DEFAULT_TIMEOUT))

            if stuck_minutes > timeout:
                return {
                    'project': project_name,
                    'stage': stage_name,
                    'agent': agent_name,
                    'status': status,
                    'stuck_duration': stuck_minutes,
                    'task': stage.get('task', ''),
                    'last_log_time': last_log_time.isoformat(),
                    'timeout': timeout
                }

        return None

    except Exception as e:
        print(f"❌ 检查项目失败 {project_file}: {e}")
        return None


def _read_today_logs() -> List[Dict]:
    log_file = get_log_file()
    if not log_file.exists():
        return []
    with open(log_file, 'r') as f:
        try:
            return json.load(f)
        except Exception:
            return []


def get_push_count_today(project: str, stage: str) -> int:
    """获取今天的推送次数"""
    logs = _read_today_logs()
    count = 0
    for log in logs:
        if (log.get('project') == project and
            log.get('stage') == stage and
            log.get('action') == 'auto-push' and
            log.get('result') == 'success'):
            count += 1
    return count


def get_last_success_push_time(project: str, stage: str) -> Optional[datetime]:
    """获取最近一次成功推送时间（用于去重冷却）"""
    logs = _read_today_logs()
    for log in reversed(logs):
        if (log.get('project') == project and
            log.get('stage') == stage and
            log.get('action') == 'auto-push' and
            log.get('result') == 'success'):
            return parse_iso_datetime(log.get('timestamp'))
    return None


def push_to_agent(project: str, task_info: Dict) -> Dict:
    """推送任务到 agent（模拟 sessions_send）"""
    stage_name = task_info['stage']
    agent_name = normalize_agent_name(task_info.get('agent', stage_name))
    session_key = AGENTS.get(agent_name) or AGENTS.get(stage_name)

    if not session_key:
        return {
            'success': False,
            'error': f'Unknown agent: {agent_name}'
        }

    # 检查推送次数
    push_count = get_push_count_today(project, stage_name)
    if push_count >= MAX_PUSH_ATTEMPTS:
        return {
            'success': False,
            'error': f'Max push attempts reached ({MAX_PUSH_ATTEMPTS})',
            'skipped': True,
            'reason': 'max-attempts'
        }

    # 去重冷却：避免短时间重复催办，减少 sessions_send timeout 噪音
    last_push_time = get_last_success_push_time(project, stage_name)
    if last_push_time:
        now = datetime.now(last_push_time.tzinfo) if last_push_time.tzinfo else datetime.now()
        diff_minutes = (now - last_push_time).total_seconds() / 60
        if diff_minutes < PUSH_COOLDOWN_MINUTES:
            return {
                'success': False,
                'error': f'Cooldown active ({diff_minutes:.1f}m < {PUSH_COOLDOWN_MINUTES}m), skip duplicate push',
                'skipped': True,
                'reason': 'cooldown',
                'cooldown_minutes_left': round(PUSH_COOLDOWN_MINUTES - diff_minutes, 1)
            }
    
    # 构造推送消息
    message = f"""
[SYSTEM|AUTO-PUSH|{agent_name.upper()}|P1]

📋 自动推送任务（检测到任务停滞）

项目: {project}
阶段: {stage_name}
Agent: {agent_name}
停滞时间: {task_info['stuck_duration']:.1f} 分钟

任务内容:
{task_info['task']}

请立即处理或更新进度。

---
⏰ 推送时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
🔄 推送次数: {push_count + 1}/{MAX_PUSH_ATTEMPTS}
"""
    
    # 在实际使用中，这里会调用 sessions_send
    # 这里只是模拟
    print(f"📤 推送到 {stage_name}: {session_key}")
    print(f"📝 消息长度: {len(message)} 字符")
    
    # 模拟成功
    return {
        'success': True,
        'session_key': session_key,
        'message_length': len(message),
        'push_count': push_count + 1
    }


def check_all_projects() -> List[Dict]:
    """检查所有项目"""
    results = []
    
    if not PROJECTS_DIR.exists():
        print(f"❌ 项目目录不存在: {PROJECTS_DIR}")
        return results
    
    # 遍历所有项目文件
    for project_file in PROJECTS_DIR.glob("*.json"):
        print(f"\n🔍 检查项目: {project_file.stem}")
        
        stuck_task = check_project(project_file)
        
        if stuck_task:
            print(f"  ⚠️  发现停滞任务: {stuck_task['stage']}")
            print(f"     停滞时间: {stuck_task['stuck_duration']:.1f} 分钟")
            print(f"     超时阈值: {stuck_task['timeout']} 分钟")
            
            results.append(stuck_task)
        else:
            print(f"  ✅ 状态正常")
    
    return results


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Task Coordinator')
    parser.add_argument('--check-all', action='store_true', help='检查所有项目')
    parser.add_argument('--project', type=str, help='检查特定项目')
    parser.add_argument('--push', action='store_true', help='推送停滞任务')
    parser.add_argument('--status', action='store_true', help='显示状态')
    
    args = parser.parse_args()
    
    if args.check_all:
        print("🔍 检查所有项目...")
        stuck_tasks = check_all_projects()
        
        if stuck_tasks:
            print(f"\n⚠️  发现 {len(stuck_tasks)} 个停滞任务")
            
            if args.push:
                print("\n📤 开始推送...")
                for task in stuck_tasks:
                    result = push_to_agent(task['project'], task)
                    
                    log_entry = {
                        'timestamp': datetime.now().isoformat(),
                        'project': task['project'],
                        'stage': task['stage'],
                        'action': 'auto-push',
                        'result': 'success' if result['success'] else ('skipped' if result.get('skipped') else 'failed'),
                        'reason': result.get('reason'),
                        'error': result.get('error'),
                        'push_count': result.get('push_count', 0)
                    }
                    
                    write_log(log_entry)
                    
                    if result['success']:
                        print(f"  ✅ {task['project']}/{task['stage']}: 推送成功")
                    elif result.get('skipped'):
                        print(f"  ⏭️  {task['project']}/{task['stage']}: {result['error']}")
                    else:
                        print(f"  ❌ {task['project']}/{task['stage']}: {result['error']}")
        else:
            print("\n✅ 所有项目状态正常")
    
    elif args.project:
        project_file = PROJECTS_DIR / f"{args.project}.json"
        
        if not project_file.exists():
            print(f"❌ 项目不存在: {args.project}")
            return
        
        print(f"🔍 检查项目: {args.project}")
        stuck_task = check_project(project_file)
        
        if stuck_task:
            print(f"⚠️  发现停滞任务: {stuck_task['stage']}")
            print(f"   停滞时间: {stuck_task['stuck_duration']:.1f} 分钟")
            
            if args.push:
                print("\n📤 推送任务...")
                result = push_to_agent(args.project, stuck_task)
                
                if result['success']:
                    print(f"✅ 推送成功")
                else:
                    print(f"❌ 推送失败: {result['error']}")
        else:
            print("✅ 项目状态正常")
    
    elif args.status:
        print("📊 Task Coordinator 状态")
        print(f"项目目录: {PROJECTS_DIR}")
        print(f"日志目录: {LOGS_DIR}")
        
        if PROJECTS_DIR.exists():
            projects = list(PROJECTS_DIR.glob("*.json"))
            print(f"项目数量: {len(projects)}")
            
            for project_file in projects:
                with open(project_file, 'r') as f:
                    project = json.load(f)
                
                print(f"\n  {project.get('project') or project.get('name') or project_file.stem}:")
                for stage_name, stage in project.get('stages', {}).items():
                    status = stage.get('status')
                    agent_name = normalize_agent_name(stage.get('agent') or stage_name)
                    icon = {'pending': '⬜', 'in-progress': '🔄', 'done': '✅'}.get(status, '❓')
                    print(f"    {icon} {stage_name} ({agent_name}): {status}")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
