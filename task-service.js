/**
 * 任务系统服务 v1.0.0
 * 提供日常任务生成、进度追踪、奖励发放
 */

const { query } = require('./database/db');

/**
 * 任务类型定义
 */
const TASK_TEMPLATES = {
  daily: [
    {
      id: 'daily_trade_1',
      type: 'trade',
      name: '初出茅庐',
      description: '完成1笔交易',
      target: 1,
      reward: { coins: 100, exp: 50 },
      tier: 'bronze'
    },
    {
      id: 'daily_trade_5',
      type: 'trade',
      name: '交易达人',
      description: '完成5笔交易',
      target: 5,
      reward: { coins: 500, exp: 200 },
      tier: 'silver'
    },
    {
      id: 'daily_holding_3',
      type: 'holding',
      name: '持仓新手',
      description: '持有3只不同股票',
      target: 3,
      reward: { coins: 200, exp: 100 },
      tier: 'bronze'
    },
    {
      id: 'daily_profit',
      type: 'profit',
      name: '盈利目标',
      description: '当日盈利达到1%',
      target: 1,
      targetUnit: 'percent',
      reward: { coins: 300, exp: 150 },
      tier: 'silver'
    },
    {
      id: 'daily_login',
      type: 'login',
      name: '每日签到',
      description: '登录游戏',
      target: 1,
      reward: { coins: 50, exp: 20 },
      tier: 'bronze'
    }
  ],
  weekly: [
    {
      id: 'weekly_trade_20',
      type: 'trade',
      name: '周交易达人',
      description: '本周完成20笔交易',
      target: 20,
      reward: { coins: 2000, exp: 1000 },
      tier: 'gold'
    },
    {
      id: 'weekly_profit_5',
      type: 'profit',
      name: '周盈利王',
      description: '本周收益率达到5%',
      target: 5,
      targetUnit: 'percent',
      reward: { coins: 3000, exp: 1500 },
      tier: 'gold'
    }
  ]
};

/**
 * 获取用户今日任务
 */
async function getUserDailyTasks(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // 检查今日任务是否已生成
  const existing = await query(
    `SELECT * FROM user_tasks 
     WHERE user_id = $1 AND task_date = $2`,
    [userId, today]
  );

  if (existing.rows.length > 0) {
    return existing.rows.map(row => ({
      ...row,
      progress: parseInt(row.progress),
      target: parseInt(row.target),
      completed: row.status === 'completed',
      claimed: row.status === 'claimed'
    }));
  }

  // 生成今日任务
  const dailyTemplates = TASK_TEMPLATES.daily;
  const tasks = [];

  for (const template of dailyTemplates) {
    const result = await query(
      `INSERT INTO user_tasks (user_id, task_id, task_date, type, name, description, progress, target, reward, status)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'pending')
       RETURNING *`,
      [userId, template.id, today, template.type, template.name, template.description, 
       template.target, JSON.stringify(template.reward)]
    );
    tasks.push(result.rows[0]);
  }

  return tasks.map(t => ({
    ...t,
    progress: 0,
    completed: false,
    claimed: false
  }));
}

/**
 * 更新任务进度
 */
async function updateTaskProgress(userId, taskType, increment = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  const result = await query(
    `UPDATE user_tasks 
     SET progress = progress + $1,
         status = CASE WHEN progress + $1 >= target AND status = 'pending' THEN 'completed' ELSE status END,
         updated_at = NOW()
     WHERE user_id = $2 AND type = $3 AND task_date = $4 AND status != 'claimed'
     RETURNING *`,
    [increment, userId, taskType, today]
  );

  return result.rows;
}

/**
 * 领取任务奖励
 */
async function claimTaskReward(userId, taskId) {
  const today = new Date().toISOString().split('T')[0];
  
  // 获取任务
  const taskResult = await query(
    `SELECT * FROM user_tasks 
     WHERE user_id = $1 AND task_id = $2 AND task_date = $3 AND status = 'completed'`,
    [userId, taskId, today]
  );

  if (taskResult.rows.length === 0) {
    throw new Error('Task not found or not completed');
  }

  const task = taskResult.rows[0];
  const reward = typeof task.reward === 'string' ? JSON.parse(task.reward) : task.reward;

  // 更新任务状态
  await query(
    `UPDATE user_tasks SET status = 'claimed', updated_at = NOW() 
     WHERE id = $1`,
    [task.id]
  );

  // 发放奖励
  if (reward.coins) {
    await query(
      `UPDATE user_profiles SET balance = balance + $1 WHERE id = $2`,
      [reward.coins, userId]
    );
  }

  if (reward.exp) {
    await query(
      `UPDATE user_profiles SET exp = COALESCE(exp, 0) + $1 WHERE id = $2`,
      [reward.exp, userId]
    );
  }

  return {
    taskId,
    reward,
    claimedAt: new Date().toISOString()
  };
}

/**
 * 重置过期任务
 */
async function resetExpiredTasks() {
  const today = new Date().toISOString().split('T')[0];
  
  await query(
    `DELETE FROM user_tasks WHERE task_date < $1 AND status = 'pending'`,
    [today]
  );
}

/**
 * 获取任务完成统计
 */
async function getTaskStats(userId) {
  const result = await query(
    `SELECT 
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'claimed' THEN 1 END) as claimed
     FROM user_tasks 
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0];
}

module.exports = {
  TASK_TEMPLATES,
  getUserDailyTasks,
  updateTaskProgress,
  claimTaskReward,
  resetExpiredTasks,
  getTaskStats
};
