#!/usr/bin/env node
/**
 * Model Usage Statistics Collector
 * 
 * 用于收集和统计模型使用情况的辅助脚本
 * 主要由 agent 通过工具调用完成统计，此脚本提供辅助功能
 * 
 * 用法：
 * node collect_stats.js --period today
 * node collect_stats.js --period yesterday
 * node collect_stats.js --period week
 */

const fs = require('fs');
const path = require('path');

// 时间范围计算
function getTimeRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: today.getTime(),
        end: now.getTime(),
        label: '今天'
      };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: yesterday.getTime(),
        end: today.getTime(),
        label: '昨天'
      };
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        start: weekAgo.getTime(),
        end: now.getTime(),
        label: '最近 7 天'
      };
    default:
      return {
        start: today.getTime(),
        end: now.getTime(),
        label: '今天'
      };
  }
}

// 统计数据结构
function createEmptyStats() {
  return {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    modelUsage: {},
    agentUsage: {},
    fallbackEvents: [],
    responseTimes: []
  };
}

// 格式化报告
function formatReport(stats, timeRange) {
  const lines = [];
  
  lines.push('📊 模型使用统计报告');
  lines.push(`时间范围：${timeRange.label}`);
  lines.push('');
  
  // 总体情况
  lines.push('## 总体情况');
  lines.push(`- 总调用次数：${stats.totalCalls}`);
  if (stats.responseTimes.length > 0) {
    const avgTime = (stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length / 1000).toFixed(1);
    lines.push(`- 平均响应时间：${avgTime}s`);
  }
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
      lines.push(`${model.padEnd(20)} ${count} 次 (${percentage}%) ${bar}`);
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
        lines.push(`  - ${model}: ${count} (${percentage}%)`);
      }
    }
    lines.push('');
  }
  
  // Fallback 情况
  if (stats.fallbackEvents.length > 0) {
    lines.push('## Fallback 情况');
    lines.push(`- Fallback 触发次数：${stats.fallbackEvents.length}`);
    const fallbackCounts = {};
    for (const event of stats.fallbackEvents) {
      const key = `${event.from} → ${event.to}`;
      fallbackCounts[key] = (fallbackCounts[key] || 0) + 1;
    }
    for (const [path, count] of Object.entries(fallbackCounts)) {
      lines.push(`  - ${path}: ${count} 次`);
    }
  }
  
  return lines.join('\n');
}

// 导出函数供外部使用
module.exports = {
  getTimeRange,
  createEmptyStats,
  formatReport
};

// 命令行使用
if (require.main === module) {
  const args = process.argv.slice(2);
  const periodIndex = args.indexOf('--period');
  const period = periodIndex >= 0 ? args[periodIndex + 1] : 'today';
  
  const timeRange = getTimeRange(period);
  console.log(JSON.stringify(timeRange, null, 2));
}
