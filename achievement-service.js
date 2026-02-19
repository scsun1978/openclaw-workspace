/**
 * 成就系统服务
 */

const { query } = require('../database/db');
const { broadcast } = require('./websocket');

// 成就缓存
let achievementsCache = null;

// 加载所有成就
async function loadAchievements() {
  if (achievementsCache) return achievementsCache;
  const result = await query('SELECT * FROM achievements');
  achievementsCache = result.rows;
  return achievementsCache;
}

// 获取用户已解锁的成就
async function getUserAchievements(userId) {
  const result = await query(
    `SELECT a.*, ua.unlocked_at 
     FROM achievements a 
     LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
     ORDER BY a.id`,
    [userId]
  );
  return result.rows;
}

// 检查并解锁成就
async function checkAndUnlock(userId, conditionType, currentValue) {
  const achievements = await loadAchievements();
  const unlocked = [];
  
  for (const ach of achievements) {
    if (ach.condition_type !== conditionType) continue;
    
    // 检查是否已解锁
    const existing = await query(
      'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
      [userId, ach.id]
    );
    if (existing.rows.length > 0) continue;
    
    // 检查条件
    let shouldUnlock = false;
    if (conditionType === 'trade_count' || conditionType === 'total_profit' || 
        conditionType === 'total_asset' || conditionType === 'holdings_count') {
      shouldUnlock = currentValue >= ach.condition_value;
    }
    
    if (shouldUnlock) {
      await query(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
        [userId, ach.id]
      );
      unlocked.push(ach);
      
      // 广播成就解锁通知
      broadcast({
        type: 'ACHIEVEMENT_UNLOCKED',
        data: {
          achievement: ach,
          timestamp: Date.now()
        }
      }, userId);
      
      console.log('[Achievement] Unlocked: ' + ach.name + ' for user ' + userId);
    }
  }
  
  return unlocked;
}

// 交易后检查成就
async function checkAfterTrade(userId) {
  // 获取交易次数
  const tradeCount = await query(
    `SELECT COUNT(*) as count FROM orders WHERE user_id = $1 AND status = 'FILLED'`,
    [userId]
  );
  await checkAndUnlock(userId, 'trade_count', parseInt(tradeCount.rows[0].count));
  
  // 获取总资产
  const user = await query('SELECT total_asset FROM users WHERE id = $1', [userId]);
  if (user.rows[0]) {
    await checkAndUnlock(userId, 'total_asset', parseFloat(user.rows[0].total_asset));
  }
  
  // 获取持仓数量
  const holdings = await query(
    `SELECT COUNT(DISTINCT symbol) as count FROM holdings WHERE user_id = $1 AND quantity > 0`,
    [userId]
  );
  await checkAndUnlock(userId, 'holdings_count', parseInt(holdings.rows[0].count));
}

module.exports = {
  loadAchievements,
  getUserAchievements,
  checkAndUnlock,
  checkAfterTrade
};
