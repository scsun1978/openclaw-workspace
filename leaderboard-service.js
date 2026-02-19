/**
 * 排行榜服务 v1.0.0
 * 提供多维度排行和 Redis 缓存
 */

const { query } = require('./database/db');

// 模拟 Redis 客户端
const redisClient = {
  cache: new Map(),
  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  },
  async set(key, value, ttlSeconds = 60) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000
    });
  },
  async del(key) {
    this.cache.delete(key);
  }
};

/**
 * 排行榜类型
 */
const LEADERBOARD_TYPES = {
  PROFIT_RATE: 'profit_rate',      // 收益率排行
  TRADE_VOLUME: 'trade_volume',    // 交易量排行
  TOTAL_ASSET: 'total_asset',      // 总资产排行
  WIN_RATE: 'win_rate',            // 胜率排行
  COMPREHENSIVE: 'comprehensive'   // 综合排行
};

/**
 * 获取排行榜缓存键
 */
function getCacheKey(type, limit = 10) {
  return `leaderboard:${type}:${limit}`;
}

/**
 * 获取收益率排行
 */
async function getProfitRateLeaderboard(limit = 10, useCache = true) {
  const cacheKey = getCacheKey(LEADERBOARD_TYPES.PROFIT_RATE, limit);
  
  if (useCache) {
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;
  }

  const result = await query(
    `SELECT 
      u.id,
      u.username,
      u.total_asset,
      u.balance,
      ((u.total_asset - 1000000) / 1000000 * 100) as profit_rate
     FROM user_profiles u
     WHERE u.total_asset > 0
     ORDER BY profit_rate DESC
     LIMIT $1`,
    [limit]
  );

  const leaderboard = result.rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    username: row.username,
    totalAsset: parseFloat(row.total_asset),
    profitRate: parseFloat(row.profit_rate).toFixed(2) + '%'
  }));

  await redisClient.set(cacheKey, leaderboard, 60); // 缓存 60 秒
  return leaderboard;
}

/**
 * 获取交易量排行
 */
async function getTradeVolumeLeaderboard(limit = 10, useCache = true) {
  const cacheKey = getCacheKey(LEADERBOARD_TYPES.TRADE_VOLUME, limit);
  
  if (useCache) {
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;
  }

  const result = await query(
    `SELECT 
      u.id,
      u.username,
      COUNT(o.id) as trade_count,
      SUM(o.quantity * o.filled_price) as total_volume
     FROM user_profiles u
     LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'FILLED'
     GROUP BY u.id, u.username
     ORDER BY total_volume DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );

  const leaderboard = result.rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    username: row.username,
    tradeCount: parseInt(row.trade_count) || 0,
    totalVolume: parseFloat(row.total_volume) || 0
  }));

  await redisClient.set(cacheKey, leaderboard, 60);
  return leaderboard;
}

/**
 * 获取综合排行 (加权计算)
 * 公式: 综合分 = 收益率*40% + 交易量归一化*30% + 胜率*30%
 */
async function getComprehensiveLeaderboard(limit = 10, useCache = true) {
  const cacheKey = getCacheKey(LEADERBOARD_TYPES.COMPREHENSIVE, limit);
  
  if (useCache) {
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;
  }

  // 获取所有指标
  const result = await query(
    `SELECT 
      u.id,
      u.username,
      u.total_asset,
      ((u.total_asset - 1000000) / 1000000 * 100) as profit_rate,
      COALESCE(t.trade_count, 0) as trade_count,
      COALESCE(t.total_volume, 0) as total_volume,
      COALESCE(w.win_rate, 0) as win_rate
     FROM user_profiles u
     LEFT JOIN (
       SELECT user_id, COUNT(*) as trade_count, SUM(quantity * filled_price) as total_volume
       FROM orders WHERE status = 'FILLED'
       GROUP BY user_id
     ) t ON t.user_id = u.id
     LEFT JOIN (
       SELECT user_id, 
         (SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as win_rate
       FROM trades
       GROUP BY user_id
     ) w ON w.user_id = u.id
     WHERE u.total_asset > 0
     LIMIT 100`
  );

  // 归一化并计算综合分
  const maxVolume = Math.max(...result.rows.map(r => parseFloat(r.total_volume) || 0));
  
  const scored = result.rows.map(row => {
    const profitRate = parseFloat(row.profit_rate) || 0;
    const volumeNorm = maxVolume > 0 ? (parseFloat(row.total_volume) || 0) / maxVolume * 100 : 0;
    const winRate = parseFloat(row.win_rate) || 0;
    
    const score = profitRate * 0.4 + volumeNorm * 0.3 + winRate * 0.3;
    
    return {
      userId: row.id,
      username: row.username,
      profitRate: profitRate.toFixed(2),
      volumeNorm: volumeNorm.toFixed(2),
      winRate: winRate.toFixed(2),
      score
    };
  });

  // 排序
  scored.sort((a, b) => b.score - a.score);

  const leaderboard = scored.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    username: row.username,
    score: row.score.toFixed(2),
    profitRate: row.profitRate + '%',
    winRate: row.winRate + '%'
  }));

  await redisClient.set(cacheKey, leaderboard, 60);
  return leaderboard;
}

/**
 * 刷新所有排行榜缓存
 */
async function refreshAllLeaderboards(limit = 10) {
  await Promise.all([
    getProfitRateLeaderboard(limit, false),
    getTradeVolumeLeaderboard(limit, false),
    getComprehensiveLeaderboard(limit, false)
  ]);
  
  return { refreshed: true, timestamp: new Date().toISOString() };
}

/**
 * 获取用户排名
 */
async function getUserRank(userId, type = LEADERBOARD_TYPES.PROFIT_RATE) {
  const limit = 100;
  let leaderboard;
  
  switch (type) {
    case LEADERBOARD_TYPES.PROFIT_RATE:
      leaderboard = await getProfitRateLeaderboard(limit);
      break;
    case LEADERBOARD_TYPES.TRADE_VOLUME:
      leaderboard = await getTradeVolumeLeaderboard(limit);
      break;
    case LEADERBOARD_TYPES.COMPREHENSIVE:
      leaderboard = await getComprehensiveLeaderboard(limit);
      break;
    default:
      throw new Error(`Unknown leaderboard type: ${type}`);
  }

  const userEntry = leaderboard.find(e => e.userId === userId);
  return userEntry ? userEntry.rank : null;
}

/**
 * 清除缓存
 */
async function clearCache(type = null) {
  if (type) {
    const keys = Array.from(redisClient.cache.keys()).filter(k => k.includes(type));
    for (const key of keys) {
      await redisClient.del(key);
    }
  } else {
    redisClient.cache.clear();
  }
  return { cleared: true };
}

module.exports = {
  LEADERBOARD_TYPES,
  getProfitRateLeaderboard,
  getTradeVolumeLeaderboard,
  getComprehensiveLeaderboard,
  refreshAllLeaderboards,
  getUserRank,
  clearCache,
  redisClient
};
