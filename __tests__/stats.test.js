/**
 * 统计服务测试套件 v1.0
 * 验证盈亏分析与交易统计 API
 */

// Mock database module - 必须在导入 stats-service 之前
const mockQuery = jest.fn();
jest.mock('../database/db', () => ({
  query: (...args) => mockQuery(...args),
  connect: jest.fn(),
  end: jest.fn()
}));

// 在 mock 之后导入被测模块
const { getUserStats, getHoldingsPnL, getLeaderboard } = require('../stats-service');

describe('Stats Service - 交易统计', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('getUserStats - 用户交易统计', () => {
    test('应正确计算总交易次数、买入/卖出笔数', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total: '100', buys: '60', sells: '40' }]
        })
        .mockResolvedValueOnce({
          rows: [{ total_volume: '5000', total_value: '150000.00' }]
        })
        .mockResolvedValueOnce({
          rows: [{ today_orders: '10', today_volume: '500' }]
        })
        .mockResolvedValueOnce({
          rows: [{ week_orders: '25', week_volume: '1200' }]
        });

      const stats = await getUserStats('user123');

      expect(stats.totalTrades).toBe(100);
      expect(stats.buyCount).toBe(60);
      expect(stats.sellCount).toBe(40);
      expect(stats.totalVolume).toBe(5000);
      expect(stats.totalValue).toBe(150000.00);
      expect(stats.todayTrades).toBe(10);
      expect(stats.todayVolume).toBe(500);
      expect(stats.weekTrades).toBe(25);
      expect(stats.weekVolume).toBe(1200);
    });

    test('应正确处理无交易记录的用户', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: null, buys: null, sells: null }] })
        .mockResolvedValueOnce({ rows: [{ total_volume: null, total_value: null }] })
        .mockResolvedValueOnce({ rows: [{ today_orders: null, today_volume: null }] })
        .mockResolvedValueOnce({ rows: [{ week_orders: null, week_volume: null }] });

      const stats = await getUserStats('emptyUser');

      expect(stats.totalTrades).toBe(0);
      expect(stats.buyCount).toBe(0);
      expect(stats.sellCount).toBe(0);
      expect(stats.totalVolume).toBe(0);
      expect(stats.totalValue).toBe(0);
    });

    test('应仅统计已成交(FILLED)的订单', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '5', buys: '3', sells: '2' }] })
        .mockResolvedValueOnce({ rows: [{ total_volume: '100', total_value: '5000' }] })
        .mockResolvedValueOnce({ rows: [{ today_orders: '0', today_volume: null }] })
        .mockResolvedValueOnce({ rows: [{ week_orders: '0', week_volume: null }] });

      await getUserStats('user456');

      // 验证查询参数包含 FILLED 状态
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = $4"),
        expect.arrayContaining(['user456', 'FILLED'])
      );
    });
  });

  describe('getLeaderboard - 排行榜', () => {
    test('应按总资产降序返回用户排行', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { username: 'top1', total_asset: '100000', balance: '50000' },
          { username: 'top2', total_asset: '90000', balance: '45000' },
          { username: 'top3', total_asset: '80000', balance: '40000' }
        ]
      });

      const leaderboard = await getLeaderboard(3);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].username).toBe('top1');
      expect(leaderboard[0].totalAsset).toBe(100000);
    });

    test('应正确限制返回数量', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getLeaderboard(10);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10]
      );
    });
  });
});

describe('Stats Service - 盈亏分析', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('getHoldingsPnL - 持仓盈亏计算', () => {
    test('应正确计算单只股票的盈亏', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { symbol: 'AAPL', quantity: '100', avg_price: '150.00' }
        ]
      });

      const marketPrices = { AAPL: { price: 160 } };
      const result = await getHoldingsPnL('user123', marketPrices);

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].symbol).toBe('AAPL');
      expect(result.holdings[0].quantity).toBe(100);
      expect(result.holdings[0].avgPrice).toBe(150.00);
      expect(result.holdings[0].currentPrice).toBe(160);
      expect(result.holdings[0].cost).toBe(15000);
      expect(result.holdings[0].marketValue).toBe(16000);
      expect(result.holdings[0].pnl).toBe(1000);
      expect(parseFloat(result.holdings[0].pnlPercent)).toBeCloseTo(6.67, 1);
    });

    test('应正确计算多只股票的组合盈亏', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { symbol: 'AAPL', quantity: '100', avg_price: '150.00' },
          { symbol: 'GOOGL', quantity: '50', avg_price: '100.00' },
          { symbol: 'MSFT', quantity: '200', avg_price: '200.00' }
        ]
      });

      const marketPrices = {
        AAPL: { price: 160 },
        GOOGL: { price: 95 },
        MSFT: { price: 220 }
      };

      const result = await getHoldingsPnL('user123', marketPrices);

      expect(result.holdings).toHaveLength(3);
      
      // 总成本: 15000 + 5000 + 40000 = 60000
      expect(parseFloat(result.summary.totalCost)).toBe(60000);
      
      // 总市值: 16000 + 4750 + 44000 = 64750
      expect(parseFloat(result.summary.totalValue)).toBe(64750);
      
      // 总盈亏: 64750 - 60000 = 4750
      expect(parseFloat(result.summary.totalPnL)).toBe(4750);
      
      // 总收益率: 4750 / 60000 * 100 = 7.92%
      expect(parseFloat(result.summary.totalPnLPercent)).toBeCloseTo(7.92, 1);
    });

    test('应正确处理亏损情况', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { symbol: 'LOSS', quantity: '100', avg_price: '200.00' }
        ]
      });

      const marketPrices = { LOSS: { price: 150 } };
      const result = await getHoldingsPnL('user123', marketPrices);

      expect(result.holdings[0].pnl).toBe(-5000);
      expect(parseFloat(result.holdings[0].pnlPercent)).toBeCloseTo(-25, 0);
      expect(parseFloat(result.summary.totalPnL)).toBe(-5000);
    });

    test('应正确处理空持仓', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getHoldingsPnL('user123', {});

      expect(result.holdings).toHaveLength(0);
      expect(parseFloat(result.summary.totalCost)).toBe(0);
      expect(parseFloat(result.summary.totalValue)).toBe(0);
      expect(parseFloat(result.summary.totalPnL)).toBe(0);
    });

    test('应使用默认价格处理无市场数据的股票', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { symbol: 'UNKNOWN', quantity: '10', avg_price: '50.00' }
        ]
      });

      const result = await getHoldingsPnL('user123', {});

      // 默认价格 100
      expect(result.holdings[0].currentPrice).toBe(100);
      expect(result.holdings[0].marketValue).toBe(1000);
    });
  });
});

describe('Stats Service - 数据一致性', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('盈亏计算公式应与交易记录对齐', async () => {
    // 模拟数据库返回的持仓数据
    mockQuery.mockResolvedValueOnce({
      rows: [
        { symbol: 'TEST', quantity: '1000', avg_price: '10.50' }
      ]
    });

    // 模拟市场数据
    const marketPrices = { TEST: { price: 12.00 } };
    const result = await getHoldingsPnL('user123', marketPrices);

    // 验证计算公式:
    // cost = avg_price * quantity = 10.50 * 1000 = 10500
    // market_value = current_price * quantity = 12.00 * 1000 = 12000
    // pnl = market_value - cost = 12000 - 10500 = 1500
    // pnl_percent = pnl / cost * 100 = 1500 / 10500 * 100 = 14.29%
    
    const holding = result.holdings[0];
    expect(holding.cost).toBe(10500);
    expect(holding.marketValue).toBe(12000);
    expect(holding.pnl).toBe(1500);
    expect(parseFloat(holding.pnlPercent)).toBeCloseTo(14.29, 1);
  });

  test('统计查询应正确使用状态过滤', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0', buys: '0', sells: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total_volume: '0', total_value: '0' }] })
      .mockResolvedValueOnce({ rows: [{ today_orders: '0', today_volume: '0' }] })
      .mockResolvedValueOnce({ rows: [{ week_orders: '0', week_volume: '0' }] });

    await getUserStats('testUser');

    // 验证所有查询都包含 FILLED 状态过滤
    const calls = mockQuery.mock.calls;
    calls.forEach(call => {
      expect(call[1]).toContain('FILLED');
    });
  });
});

describe('Stats Service - 边界条件', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('应正确处理零成本持仓（极端情况）', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { symbol: 'FREE', quantity: '100', avg_price: '0.00' }
      ]
    });

    const result = await getHoldingsPnL('user123', { FREE: { price: 10 } });

    // 零成本时收益率应该处理为0或特殊值，避免除零错误
    expect(result.holdings[0].cost).toBe(0);
    expect(parseFloat(result.holdings[0].pnlPercent)).toBe(0);
  });

  test('应正确处理数据库查询错误', async () => {
    mockQuery.mockRejectedValue(new Error('Database connection failed'));

    await expect(getUserStats('user123')).rejects.toThrow('Database connection failed');
  });
});
