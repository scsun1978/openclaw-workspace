/**
 * 统计服务 v1.5.0
 * 提供交易统计和盈亏分析
 */

const { query } = require('./database/db');

/**
 * 获取用户交易统计
 */
async function getUserStats(userId) {
  // 总交易次数
  const ordersResult = await query(
    'SELECT COUNT(*) as total, SUM(CASE WHEN side = $1 THEN 1 ELSE 0 END) as buys, SUM(CASE WHEN side = $2 THEN 1 ELSE 0 END) as sells FROM orders WHERE user_id = $3 AND status = $4',
    ['BUY', 'SELL', userId, 'FILLED']
  );
  
  // 总成交量（股数）
  const volumeResult = await query(
    'SELECT SUM(quantity) as total_volume, SUM(quantity * filled_price) as total_value FROM orders WHERE user_id = $1 AND status = $2',
    [userId, 'FILLED']
  );
  
  // 今日交易
  const todayResult = await query(
    "SELECT COUNT(*) as today_orders, SUM(quantity) as today_volume FROM orders WHERE user_id = $1 AND status = $2 AND DATE(created_at) = CURRENT_DATE",
    [userId, 'FILLED']
  );
  
  // 本周交易
  const weekResult = await query(
    "SELECT COUNT(*) as week_orders, SUM(quantity) as week_volume FROM orders WHERE user_id = $1 AND status = $2 AND created_at >= DATE_TRUNC('week', CURRENT_DATE)",
    [userId, 'FILLED']
  );

  const orders = ordersResult.rows[0];
  const volume = volumeResult.rows[0];
  const today = todayResult.rows[0];
  const week = weekResult.rows[0];

  return {
    totalTrades: parseInt(orders.total) || 0,
    buyCount: parseInt(orders.buys) || 0,
    sellCount: parseInt(orders.sells) || 0,
    totalVolume: parseInt(volume.total_volume) || 0,
    totalValue: parseFloat(volume.total_value) || 0,
    todayTrades: parseInt(today.today_orders) || 0,
    todayVolume: parseInt(today.today_volume) || 0,
    weekTrades: parseInt(week.week_orders) || 0,
    weekVolume: parseInt(week.week_volume) || 0
  };
}

/**
 * 获取持仓盈亏分析
 */
async function getHoldingsPnL(userId, marketPrices) {
  const holdings = await query(
    'SELECT symbol, quantity, avg_price FROM holdings WHERE user_id = $1 AND quantity > 0',
    [userId]
  );
  
  const pnlList = [];
  let totalCost = 0;
  let totalValue = 0;
  
  for (const h of holdings.rows) {
    const currentPrice = marketPrices[h.symbol]?.price || 100;
    const cost = parseFloat(h.avg_price) * parseInt(h.quantity);
    const value = currentPrice * parseInt(h.quantity);
    const pnl = value - cost;
    const pnlPercent = cost > 0 ? ((pnl / cost) * 100) : 0;
    
    totalCost += cost;
    totalValue += value;
    
    pnlList.push({
      symbol: h.symbol,
      quantity: parseInt(h.quantity),
      avgPrice: parseFloat(h.avg_price),
      currentPrice: currentPrice,
      cost: cost,
      marketValue: value,
      pnl: pnl,
      pnlPercent: pnlPercent.toFixed(2)
    });
  }
  
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;
  
  return {
    holdings: pnlList,
    summary: {
      totalCost: totalCost.toFixed(2),
      totalValue: totalValue.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      totalPnLPercent: totalPnLPercent.toFixed(2)
    }
  };
}

/**
 * 获取排行榜数据
 */
async function getLeaderboard(limit = 10) {
  const result = await query(
    'SELECT username, total_asset, balance FROM users ORDER BY total_asset DESC LIMIT $1',
    [limit]
  );
  return result.rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    totalAsset: parseFloat(row.total_asset),
    balance: parseFloat(row.balance)
  }));
}

module.exports = {
  getUserStats,
  getHoldingsPnL,
  getLeaderboard
};
