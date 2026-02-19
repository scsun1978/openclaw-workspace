/**
 * K线服务 v1.0.0
 * 提供 OHLCV 数据聚合和查询
 */

const { query } = require('./database/db');

/**
 * 时间周期配置 (毫秒)
 */
const INTERVALS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

/**
 * 获取K线数据
 * @param {string} symbol - 股票代码
 * @param {string} interval - 时间周期 (1m, 5m, 15m, 1h, 1d)
 * @param {number} limit - 返回数据条数
 */
async function getKlines(symbol, interval = '1d', limit = 100) {
  if (!INTERVALS[interval]) {
    throw new Error(`Invalid interval: ${interval}. Valid: ${Object.keys(INTERVALS).join(', ')}`);
  }

  const intervalMs = INTERVALS[interval];
  
  // 从 tick 数据聚合 K线
  const result = await query(
    `SELECT 
      FLOOR(EXTRACT(EPOCH FROM created_at) * 1000 / $1) * $1 as time_bucket,
      MIN(price) as low,
      MAX(price) as high,
      FIRST_VALUE(price) OVER (PARTITION BY time_bucket ORDER BY created_at) as open,
      LAST_VALUE(price) OVER (PARTITION BY time_bucket ORDER BY created_at RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as close,
      SUM(quantity) as volume
    FROM (
      SELECT 
        created_at,
        price,
        quantity,
        FLOOR(EXTRACT(EPOCH FROM created_at) * 1000 / $1) * $1 as time_bucket
      FROM ticks
      WHERE symbol = $2
      ORDER BY created_at DESC
      LIMIT $3 * 100
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT $3`,
    [intervalMs, symbol, limit]
  );

  return result.rows.map(row => ({
    time: parseInt(row.time_bucket),
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
    volume: parseInt(row.volume) || 0
  }));
}

/**
 * 从 tick 数据聚合 OHLCV
 * @param {Array} ticks - 原始 tick 数据 [{time, price, quantity}]
 * @param {string} interval - 目标周期
 */
function aggregateOHLCV(ticks, interval = '1m') {
  if (!ticks || ticks.length === 0) {
    return [];
  }

  if (!INTERVALS[interval]) {
    throw new Error(`Invalid interval: ${interval}`);
  }

  const intervalMs = INTERVALS[interval];
  const buckets = new Map();

  // 按 time bucket 分组
  for (const tick of ticks) {
    const bucket = Math.floor(tick.time / intervalMs) * intervalMs;
    
    if (!buckets.has(bucket)) {
      buckets.set(bucket, {
        time: bucket,
        prices: [],
        volumes: [],
        timestamps: []
      });
    }

    const bucketData = buckets.get(bucket);
    bucketData.prices.push(tick.price);
    bucketData.volumes.push(tick.quantity || 0);
    bucketData.timestamps.push(tick.time);
  }

  // 计算 OHLCV
  const result = [];
  for (const [bucket, data] of buckets) {
    // 找到最早和最晚的 tick
    const sortedIdx = data.timestamps
      .map((t, i) => ({ t, i }))
      .sort((a, b) => a.t - b.t);
    
    const openIdx = sortedIdx[0].i;
    const closeIdx = sortedIdx[sortedIdx.length - 1].i;

    result.push({
      time: bucket,
      open: data.prices[openIdx],
      high: Math.max(...data.prices),
      low: Math.min(...data.prices),
      close: data.prices[closeIdx],
      volume: data.volumes.reduce((a, b) => a + b, 0)
    });
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * 验证 K线聚合一致性
 * @param {Array} klines1m - 1分钟 K线数据
 * @param {Array} klines5m - 5分钟 K线数据
 */
function validateConsistency(klines1m, klines5m) {
  const errors = [];
  
  for (const k5 of klines5m) {
    // 找到对应的 1m K线
    const relevant1m = klines1m.filter(k1 => 
      k1.time >= k5.time && k1.time < k5.time + 5 * 60 * 1000
    );

    if (relevant1m.length === 0) continue;

    // 验证 High
    const expectedHigh = Math.max(...relevant1m.map(k => k.high));
    if (Math.abs(k5.high - expectedHigh) > 0.001) {
      errors.push(`High mismatch at ${k5.time}: expected ${expectedHigh}, got ${k5.high}`);
    }

    // 验证 Low
    const expectedLow = Math.min(...relevant1m.map(k => k.low));
    if (Math.abs(k5.low - expectedLow) > 0.001) {
      errors.push(`Low mismatch at ${k5.time}: expected ${expectedLow}, got ${k5.low}`);
    }

    // 验证 Open (应该是第一个 1m K线的 Open)
    const expectedOpen = relevant1m[0].open;
    if (Math.abs(k5.open - expectedOpen) > 0.001) {
      errors.push(`Open mismatch at ${k5.time}: expected ${expectedOpen}, got ${k5.open}`);
    }

    // 验证 Close (应该是最后一个 1m K线的 Close)
    const expectedClose = relevant1m[relevant1m.length - 1].close;
    if (Math.abs(k5.close - expectedClose) > 0.001) {
      errors.push(`Close mismatch at ${k5.time}: expected ${expectedClose}, got ${k5.close}`);
    }

    // 验证 Volume
    const expectedVolume = relevant1m.reduce((sum, k) => sum + k.volume, 0);
    if (k5.volume !== expectedVolume) {
      errors.push(`Volume mismatch at ${k5.time}: expected ${expectedVolume}, got ${k5.volume}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取最新价格
 */
async function getLatestPrice(symbol) {
  const result = await query(
    'SELECT price FROM ticks WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1',
    [symbol]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return parseFloat(result.rows[0].price);
}

module.exports = {
  getKlines,
  aggregateOHLCV,
  validateConsistency,
  getLatestPrice,
  INTERVALS
};
