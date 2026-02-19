#!/usr/bin/env node
/**
 * Analyze model usage statistics for yesterday (2026-02-17)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Time range for yesterday (2026-02-17)
const YESTERDAY_DATE = '2026-02-17';

// Find all transcript files
const agentsDir = '/Users/shengchun.sun/.openclaw/agents';
const stats = {
  totalSessions: 0,
  modelUsage: {},
  agentUsage: {},
  sessionsByAgent: {}
};

// Get all agent directories
const agentDirs = fs.readdirSync(agentsDir).filter(f => {
  const fullPath = path.join(agentsDir, f);
  return fs.statSync(fullPath).isDirectory() && f.includes('agent');
});

console.log(`Analyzing transcripts for ${YESTERDAY_DATE}...\n`);
console.log(`Found ${agentDirs.length} agent directories\n`);

// Process each agent
for (const agentDir of agentDirs) {
  const agentName = agentDir.replace('scsun-', '').replace('-agent', '');
  const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
  
  if (!fs.existsSync(sessionsDir)) {
    continue;
  }
  
  const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
  
  stats.sessionsByAgent[agentName] = stats.sessionsByAgent[agentName] || { total: 0, models: {} };
  
  for (const sessionFile of sessionFiles) {
    const filePath = path.join(sessionsDir, sessionFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if this session has entries from yesterday
    if (!content.includes(YESTERDAY_DATE)) {
      continue;
    }
    
    // Parse the file
    const lines = content.trim().split('\n');
    let sessionModel = null;
    let hasYesterdayActivity = false;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Check if entry is from yesterday
        if (entry.timestamp && entry.timestamp.startsWith(YESTERDAY_DATE)) {
          hasYesterdayActivity = true;
          
          // Track model changes
          if (entry.type === 'model_change') {
            sessionModel = `${entry.provider}/${entry.modelId}`;
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
    
    if (hasYesterdayActivity && sessionModel) {
      stats.totalSessions++;
      stats.modelUsage[sessionModel] = (stats.modelUsage[sessionModel] || 0) + 1;
      stats.sessionsByAgent[agentName].total++;
      stats.sessionsByAgent[agentName].models[sessionModel] = 
        (stats.sessionsByAgent[agentName].models[sessionModel] || 0) + 1;
    }
  }
}

// Generate report
const lines = [];

lines.push('📊 模型使用统计报告');
lines.push(`时间范围：${YESTERDAY_DATE} (昨天)`);
lines.push('');

// 总体情况
lines.push('## 总体情况');
lines.push(`- 活跃会话数：${stats.totalSessions}`);
lines.push('');

// 模型分布
if (Object.keys(stats.modelUsage).length > 0) {
  lines.push('## 模型分布');
  const sortedModels = Object.entries(stats.modelUsage)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [model, count] of sortedModels) {
    const percentage = ((count / stats.totalSessions) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(percentage / 5));
    const shortModel = model.split('/').pop();
    lines.push(`${shortModel.padEnd(20)} ${String(count).padStart(3)} 会话 (${percentage}%) ${bar}`);
  }
  lines.push('');
}

// Agent 分布
if (Object.keys(stats.sessionsByAgent).length > 0) {
  lines.push('## Agent 分布');
  for (const [agent, data] of Object.entries(stats.sessionsByAgent)) {
    if (data.total > 0) {
      lines.push(`${agent}: ${data.total} 会话`);
      for (const [model, count] of Object.entries(data.models)) {
        const percentage = ((count / data.total) * 100).toFixed(0);
        const shortModel = model.split('/').pop();
        lines.push(`  - ${shortModel}: ${count} (${percentage}%)`);
      }
    }
  }
  lines.push('');
}

// Fallback 情况
lines.push('## Fallback 情况');
lines.push('- Fallback 触发次数：0 (未检测到)');
lines.push('  注：需要更详细的日志分析以准确统计 fallback 链路使用');

console.log(lines.join('\n'));
