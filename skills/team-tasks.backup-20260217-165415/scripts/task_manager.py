#!/usr/bin/env python3
"""
Team Tasks - Multi-Agent Pipeline Coordination
A simplified version for demonstration.
Full version: https://github.com/win4r/team-tasks
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any

# Data directory
DATA_DIR = os.environ.get('TEAM_TASKS_DIR', 
                          '/Users/shengchun.sun/.openclaw/workspace/data/team-tasks')

class TaskManager:
    def __init__(self):
        self.data_dir = Path(DATA_DIR)
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def init_project(self, name: str, goal: str, mode: str = 'linear', 
                     pipeline: Optional[str] = None):
        """Initialize a new project."""
        project_file = self.data_dir / f"{name}.json"
        
        if project_file.exists():
            print(f"❌ Project '{name}' already exists")
            return
        
        project = {
            'name': name,
            'goal': goal,
            'mode': mode,
            'status': 'active',
            'created_at': datetime.now().isoformat(),
            'stages': {},
            'pipeline': pipeline.split(',') if pipeline else []
        }
        
        if mode == 'linear' and pipeline:
            for stage in project['pipeline']:
                project['stages'][stage] = {
                    'status': 'pending',
                    'task': '',
                    'output': '',
                    'logs': []
                }
        
        self._save_project(name, project)
        print(f"✅ Project '{name}' created ({mode} mode)")
    
    def status(self, name: str):
        """Show project status."""
        project = self._load_project(name)
        if not project:
            return
        
        print(f"\n📋 Project: {project['name']}")
        print(f"🎯 Goal: {project['goal']}")
        print(f"📊 Status: {project['status']} | Mode: {project['mode']}")
        
        if project['mode'] == 'linear':
            print(f"▶️ Current: {self._get_current_stage(project)}")
        
        print()
        
        status_icons = {
            'pending': '⬜',
            'in-progress': '🔄',
            'done': '✅',
            'failed': '❌',
            'skipped': '⏭️'
        }
        
        for stage_name, stage_data in project['stages'].items():
            icon = status_icons.get(stage_data['status'], '❓')
            print(f"  {icon} {stage_name}: {stage_data['status']}")
            if stage_data['task']:
                print(f"     Task: {stage_data['task']}")
            if stage_data['output']:
                print(f"     Output: {stage_data['output']}")
    
    def assign(self, name: str, stage: str, task: str):
        """Assign task to a stage."""
        project = self._load_project(name)
        if not project:
            return
        
        if stage not in project['stages']:
            print(f"❌ Stage '{stage}' not found")
            return
        
        project['stages'][stage]['task'] = task
        self._save_project(name, project)
        print(f"✅ Task assigned to '{stage}'")
    
    def update(self, name: str, stage: str, status: str):
        """Update stage status."""
        project = self._load_project(name)
        if not project:
            return
        
        if stage not in project['stages']:
            print(f"❌ Stage '{stage}' not found")
            return
        
        project['stages'][stage]['status'] = status
        project['stages'][stage]['logs'].append({
            'timestamp': datetime.now().isoformat(),
            'action': f'Status changed to {status}'
        })
        
        self._save_project(name, project)
        print(f"✅ {stage} → {status}")
    
    def result(self, name: str, stage: str, output: str):
        """Save stage output."""
        project = self._load_project(name)
        if not project:
            return
        
        if stage not in project['stages']:
            print(f"❌ Stage '{stage}' not found")
            return
        
        project['stages'][stage]['output'] = output
        self._save_project(name, project)
        print(f"✅ Output saved for '{stage}'")
    
    def next(self, name: str):
        """Get next stage (linear mode)."""
        project = self._load_project(name)
        if not project:
            return
        
        if project['mode'] != 'linear':
            print("❌ 'next' only works in linear mode")
            return
        
        current = self._get_current_stage(project)
        if current:
            print(f"▶️ Next stage: {current}")
        else:
            print("✅ All stages complete!")
    
    def list_projects(self):
        """List all projects."""
        projects = list(self.data_dir.glob('*.json'))
        
        if not projects:
            print("No projects found")
            return
        
        print("\n📋 Projects:")
        for project_file in projects:
            project = self._load_project(project_file.stem)
            if project:
                print(f"  • {project['name']} ({project['mode']}) - {project['status']}")
    
    def _get_current_stage(self, project: Dict) -> Optional[str]:
        """Get current stage in linear pipeline."""
        for stage in project.get('pipeline', []):
            if project['stages'].get(stage, {}).get('status') != 'done':
                return stage
        return None
    
    def _load_project(self, name: str) -> Optional[Dict]:
        """Load project from file."""
        project_file = self.data_dir / f"{name}.json"
        
        if not project_file.exists():
            print(f"❌ Project '{name}' not found")
            return None
        
        with open(project_file, 'r') as f:
            return json.load(f)
    
    def _save_project(self, name: str, project: Dict):
        """Save project to file."""
        project_file = self.data_dir / f"{name}.json"
        
        with open(project_file, 'w') as f:
            json.dump(project, f, indent=2)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 task_manager.py <command> [args]")
        print("\nCommands:")
        print("  init <project> -g \"goal\" [-m linear|dag|debate] [-p \"agent1,agent2\"]")
        print("  status <project>")
        print("  assign <project> <stage> \"task\"")
        print("  update <project> <stage> <status>")
        print("  result <project> <stage> \"output\"")
        print("  next <project>")
        print("  list")
        return
    
    tm = TaskManager()
    command = sys.argv[1]
    
    try:
        if command == 'init':
            name = sys.argv[2]
            goal = ''
            mode = 'linear'
            pipeline = None
            
            i = 3
            while i < len(sys.argv):
                if sys.argv[i] == '-g' and i + 1 < len(sys.argv):
                    goal = sys.argv[i + 1]
                    i += 2
                elif sys.argv[i] == '-m' and i + 1 < len(sys.argv):
                    mode = sys.argv[i + 1]
                    i += 2
                elif sys.argv[i] == '-p' and i + 1 < len(sys.argv):
                    pipeline = sys.argv[i + 1]
                    i += 2
                else:
                    i += 1
            
            tm.init_project(name, goal, mode, pipeline)
        
        elif command == 'status':
            tm.status(sys.argv[2])
        
        elif command == 'assign':
            tm.assign(sys.argv[2], sys.argv[3], sys.argv[4])
        
        elif command == 'update':
            tm.update(sys.argv[2], sys.argv[3], sys.argv[4])
        
        elif command == 'result':
            tm.result(sys.argv[2], sys.argv[3], sys.argv[4])
        
        elif command == 'next':
            tm.next(sys.argv[2])
        
        elif command == 'list':
            tm.list_projects()
        
        else:
            print(f"❌ Unknown command: {command}")
    
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    main()
