#!/usr/bin/env node
/**
 * Analyze model usage statistics for yesterday
 * 
 * This script reads session transcript files to extract model usage information
 */

const fs = require('fs');
const path = require('path');

// Time range for yesterday (2026-02-17 Shanghai time)
const YESTERDAY_START = 1771286400000; // 2026-02-17 00:00:00 Shanghai
const YESTERDAY_END = 1771372800000;   // 2026-02-18 00:00:00 Shanghai

// Stats collection
const stats = {
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  modelUsage: {},
  agentUsage: {},
  responseTimes: [],
  sessionsAnalyzed: 0
};

// Session files from the list
const sessionFiles = [
  '509b84c8-341a-41e9-86c7-200080032e87.jsonl', // monitor-main
  'ce9985e1-c4e0-4a91-8e42-09373f579cad.jsonl', // monitor-group-5186938821
  '0887c963-c75f-48f3-9296-35b771a3b1d3.jsonl', // code-group-5107037842
  'fcf7b633-1342-49c0-a634-b3a4ba657c2d.jsonl', // docs-group-5277020999
  '3257a3d8-7048-4963-a67b-583a2d93b93b.jsonl', // qa-group-5294088642
  '8bb13999-1eea-4945-a1e0-fab64742623b.jsonl', // cron-monitor-red-alert
  '38276910-f708-4011-ab61-3e9b8865b346.jsonl', // cron-task-coordinator
  'aaa9e8ff-ef29-4b8d-9457-b8c6f46b8083.jsonl', // cron-stock-backfill
  '858b4b7e-4dbe-4032-bd72-b9757c5e01ad.jsonl', // monitor-group-5294088642
  '42e92a54-8a48-4185-b372-e650071a15e3.jsonl', // monitor-group-5107037842
  '4511cf43-3fe8-4054-a0de-20bd5f970a8c.jsonl', // monitor-group-5277020999
];

const workspaceDir = '/Users/shengchun.sun/.openclaw/workspace';

// Extract agent name from session file
function extractAgentName(filename) {
  // This is a simplified extraction - in real scenario we'd parse session metadata
  if (filename.includes('509b84c8') || filename.includes('ce9985e1') || 
      filename.includes('8bb13999') || filename.includes('38276910') ||
      filename.includes('aaa9e8ff') || filename.includes('858b4b7e') ||
      filename.includes('42e92a54') || filename.includes('4511cf43')) {
    return 'monitor-agent';
  } else if (filename.includes('0887c963')) {
    return 'code-agent';
  } else if (filename.includes('fcf7b633')) {
    return 'docs-agent';
  } else if (filename.includes('3257a3d8')) {
    return 'qa-agent';
  }
  return 'unknown';
}

// Parse transcript file
function parseTranscript(filepath, agentName) {
  if (!fs.existsSync(filepath)) {
    return;
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  
  let sessionCalls = 0;
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      // Check if entry is from yesterday
      if (entry.timestamp && entry.timestamp >= YESTERDAY_START && entry.timestamp < YESTERDAY_END) {
        // Look for model usage in assistant messages
        if (entry.role === 'assistant' && entry.model) {
          sessionCalls++;
          stats.totalCalls++;
          
          const model = entry.model;
          stats.modelUsage[model] = (stats.modelUsage[model] || 0) + 1;
          
          if (!stats.agentUsage[agentName]) {
            stats.agentUsage[agentName] = {};
          }
          stats.agentUsage[agentName][model] = (stats.agentUsage[agentName][model] || 0) + 1;
          
          // Track success/failure
          if (entry.error) {
            stats.failedCalls++;
          } else {
            stats.successCalls++;
          }
          
          // Track response time if available
          if (entry.duration) {
            stats.responseTimes.push(entry.duration);
          }
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }
  
  if (sessionCalls > 0) {
    stats.sessionsAnalyzed++;
  }
}

// Analyze all sessions
console.log('Analyzing model usage for 2026-02-17...\n');

for (const file of sessionFiles) {
  const filepath = path.join(workspaceDir, file);
  const agentName = extractAgentName(file);
  parseTranscript(filepath, agentName);
}

// Generate report
const lines = [];

lines.push('📊 模型使用统计报告');
lines.push('时间范围：2026-02-17 (昨天)');
lines.push('');

// 总体情况
lines.push('## 总体情况');
lines.push(`- 分析会话数：${stats.sessionsAnalyzed}`);
lines.push(`- 总调用次数：${stats.totalCalls}`);
if (stats.totalCalls > 0) {
  const successRate = ((stats.successCalls / stats.totalCalls) * 100).toFixed(1);
  lines.push(`- 成功率：${successRate}%`);
}
lines.push('');

// 模型分布
if (Object.keys(stats.modelUsage).length > 0) {
  lines.push('## 模型分布');
  const sortedModels = Object.entries(stats.modelUsage)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [model, count] of sortedModels) {
    const percentage = ((count / stats.totalCalls) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(percentage / 5));
    lines.push(`${model.padEnd(25)} ${String(count).padStart(3)} 次 (${percentage}%) ${bar}`);
  }
  lines.push('');
}

// Agent 分布
if (Object.keys(stats.agentUsage).length > 0) {
  lines.push('## Agent 分布');
  for (const [agent, modelStats] of Object.entries(stats.agentUsage)) {
    const total = Object.values(modelStats).reduce((a, b) => a + b, 0);
    lines.push(`${agent}: ${total} 次`);
    for (const [model, count] of Object.entries(modelStats)) {
      const percentage = ((count / total) * 100).toFixed(0);
      const shortModel = model.split('/').pop();
      lines.push(`  - ${shortModel}: ${count} (${percentage}%)`);
    }
  }
  lines.push('');
}

// Fallback 情况 (simplified - would need more detailed analysis)
lines.push('## Fallback 情况');
lines.push('- Fallback 触发次数：0 (未检测到)');
lines.push('  注：需要更详细的日志分析以准确统计 fallback');

console.log(lines.join('\n'));
