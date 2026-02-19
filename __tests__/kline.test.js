/**
 * K线服务测试套件 v1.0
 * 验证 OHLCV 聚合和多周期一致性
 */

// Mock database module
const mockQuery = jest.fn();
jest.mock('../database/db', () => ({
  query: (...args) => mockQuery(...args),
  connect: jest.fn(),
  end: jest.fn()
}));

const { 
  getKlines, 
  aggregateOHLCV, 
  validateConsistency,
  getLatestPrice,
  INTERVALS 
} = require('../kline-service');

describe('Kline Service - OHLCV 聚合', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('aggregateOHLCV - K线聚合计算', () => {
    test('应正确计算单根K线的 OHLCV', () => {
      const ticks = [
        { time: 1000, price: 100, quantity: 10 },
        { time: 2000, price: 105, quantity: 15 },
        { time: 3000, price: 98, quantity: 20 },
        { time: 59000, price: 102, quantity: 12 }
      ];

      const klines = aggregateOHLCV(ticks, '1m');

      expect(klines).toHaveLength(1);
      expect(klines[0].open).toBe(100);   // 第一个价格
      expect(klines[0].high).toBe(105);   // 最高价
      expect(klines[0].low).toBe(98);     // 最低价
      expect(klines[0].close).toBe(102);  // 最后一个价格
      expect(klines[0].volume).toBe(57);  // 10 + 15 + 20 + 12
    });

    test('应正确按时间周期分组', () => {
      const ticks = [
        // 第一个 1m 周期 (0-60000ms)
        { time: 1000, price: 100, quantity: 10 },
        { time: 30000, price: 102, quantity: 10 },
        { time: 59000, price: 101, quantity: 10 },
        // 第二个 1m 周期 (60000-120000ms)
        { time: 61000, price: 103, quantity: 15 },
        { time: 90000, price: 106, quantity: 20 },
        { time: 119000, price: 104, quantity: 12 }
      ];

      const klines = aggregateOHLCV(ticks, '1m');

      expect(klines).toHaveLength(2);
      
      // 第一根 K线
      expect(klines[0].time).toBe(0);
      expect(klines[0].open).toBe(100);
      expect(klines[0].close).toBe(101);
      expect(klines[0].volume).toBe(30);

      // 第二根 K线
      expect(klines[1].time).toBe(60000);
      expect(klines[1].open).toBe(103);
      expect(klines[1].close).toBe(104);
      expect(klines[1].volume).toBe(47);
    });

    test('应正确处理 5m 周期聚合', () => {
      const ticks = [];
      const baseTime = 0;
      
      // 生成 10 分钟的数据 (每分钟 2 条)
      for (let min = 0; min < 10; min++) {
        ticks.push({ 
          time: baseTime + min * 60000, 
          price: 100 + min, 
          quantity: 10 
        });
        ticks.push({ 
          time: baseTime + min * 60000 + 30000, 
          price: 100 + min + 0.5, 
          quantity: 5 
        });
      }

      const klines5m = aggregateOHLCV(ticks, '5m');

      expect(klines5m).toHaveLength(2);
      
      // 第一根 5m K线 (0-5分钟)
      expect(klines5m[0].time).toBe(0);
      expect(klines5m[0].open).toBe(100);   // 第一条 tick
      expect(klines5m[0].close).toBe(104.5); // 第 5 分钟的最后一条
      expect(klines5m[0].volume).toBe(75);   // 5分钟 * 15 volume

      // 第二根 5m K线 (5-10分钟)
      expect(klines5m[1].time).toBe(300000); // 5 * 60000
      expect(klines5m[1].open).toBe(105);
    });

    test('应正确处理 1d 周期聚合', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const ticks = [
        { time: 0, price: 100, quantity: 100 },
        { time: oneDayMs / 2, price: 110, quantity: 50 },
        { time: oneDayMs - 1, price: 105, quantity: 80 },
        { time: oneDayMs, price: 106, quantity: 60 }
      ];

      const klines1d = aggregateOHLCV(ticks, '1d');

      expect(klines1d).toHaveLength(2);
      expect(klines1d[0].time).toBe(0);
      expect(klines1d[0].open).toBe(100);
      expect(klines1d[0].close).toBe(105);
      expect(klines1d[0].high).toBe(110);
      expect(klines1d[0].low).toBe(100);
      expect(klines1d[0].volume).toBe(230);
    });

    test('应正确处理空数据', () => {
      const klines = aggregateOHLCV([], '1m');
      expect(klines).toHaveLength(0);
    });

    test('应拒绝无效的时间周期', () => {
      expect(() => {
        aggregateOHLCV([{ time: 0, price: 100, quantity: 10 }], 'invalid');
      }).toThrow('Invalid interval: invalid');
    });
  });

  describe('多周期一致性验证', () => {
    test('1m 聚合结果应与 5m 聚合结果一致', () => {
      // 生成 15 分钟的 tick 数据
      const ticks = [];
      for (let min = 0; min < 15; min++) {
        for (let sec = 0; sec < 60; sec += 10) {
          const price = 100 + Math.random() * 10;
          const quantity = Math.floor(Math.random() * 100) + 10;
          ticks.push({
            time: min * 60000 + sec * 1000,
            price,
            quantity
          });
        }
      }

      const klines1m = aggregateOHLCV(ticks, '1m');
      const klines5m = aggregateOHLCV(ticks, '5m');

      const result = validateConsistency(klines1m, klines5m);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('应检测到不一致的数据', () => {
      const klines1m = [
        { time: 0, open: 100, high: 110, low: 95, close: 105, volume: 100 },
        { time: 60000, open: 105, high: 112, low: 100, close: 108, volume: 120 },
        { time: 120000, open: 108, high: 115, low: 105, close: 112, volume: 90 },
        { time: 180000, open: 112, high: 118, low: 108, close: 115, volume: 110 },
        { time: 240000, open: 115, high: 120, low: 112, close: 118, volume: 80 }
      ];

      // 这个 5m K线的高价与 1m 数据不一致
      const klines5m = [
        { time: 0, open: 100, high: 999, low: 95, close: 118, volume: 500 }  // high 应该是 120
      ];

      const result = validateConsistency(klines1m, klines5m);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('High mismatch');
    });

    test('5m 数据应覆盖完整的 1m 数据范围', () => {
      const ticks = [];
      for (let i = 0; i < 300; i++) { // 5分钟，每秒1条
        ticks.push({
          time: i * 1000,
          price: 100 + (i % 10),
          quantity: 10
        });
      }

      const klines1m = aggregateOHLCV(ticks, '1m');
      const klines5m = aggregateOHLCV(ticks, '5m');

      // 5分钟应该只有 1 根 K线
      expect(klines5m).toHaveLength(1);
      
      // 1分钟应该有 5 根 K线
      expect(klines1m).toHaveLength(5);

      // 验证 5m K线覆盖所有 1m K线
      const total1mVolume = klines1m.reduce((sum, k) => sum + k.volume, 0);
      expect(klines5m[0].volume).toBe(total1mVolume);
    });
  });
});

describe('Kline Service - 数据库查询', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('getKlines', () => {
    test('应正确查询 K线数据', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { time_bucket: '0', open: '100', high: '110', low: '95', close: '105', volume: '1000' },
          { time_bucket: '60000', open: '105', high: '115', low: '100', close: '112', volume: '1200' }
        ]
      });

      const klines = await getKlines('AAPL', '1m', 10);

      expect(klines).toHaveLength(2);
      expect(klines[0].time).toBe(0);
      expect(klines[0].open).toBe(100);
      expect(klines[0].high).toBe(110);
      expect(klines[0].low).toBe(95);
      expect(klines[0].close).toBe(105);
      expect(klines[0].volume).toBe(1000);
    });

    test('应拒绝无效的周期参数', async () => {
      await expect(getKlines('AAPL', 'invalid', 10))
        .rejects.toThrow('Invalid interval: invalid');
    });

    test('应正确处理空结果', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const klines = await getKlines('UNKNOWN', '1m', 10);

      expect(klines).toHaveLength(0);
    });
  });

  describe('getLatestPrice', () => {
    test('应返回最新价格', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ price: '150.25' }]
      });

      const price = await getLatestPrice('AAPL');

      expect(price).toBe(150.25);
    });

    test('无数据时应返回 null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const price = await getLatestPrice('UNKNOWN');

      expect(price).toBeNull();
    });
  });
});

describe('Kline Service - 性能测试', () => {
  test('大规模 tick 聚合应在合理时间内完成', () => {
    // 生成 10000 条 tick 数据
    const ticks = [];
    for (let i = 0; i < 10000; i++) {
      ticks.push({
        time: i * 100, // 每 100ms 一条
        price: 100 + Math.sin(i / 100) * 10,
        quantity: Math.floor(Math.random() * 100) + 1
      });
    }

    const start = Date.now();
    const klines = aggregateOHLCV(ticks, '1m');
    const elapsed = Date.now() - start;

    expect(klines.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000); // 应在 1 秒内完成
  });

  test('多周期聚合性能', () => {
    const ticks = [];
    for (let i = 0; i < 5000; i++) {
      ticks.push({
        time: i * 1000,
        price: 100 + (i % 50),
        quantity: 10 + (i % 20)
      });
    }

    const start = Date.now();
    const klines1m = aggregateOHLCV(ticks, '1m');
    const klines5m = aggregateOHLCV(ticks, '5m');
    const klines1h = aggregateOHLCV(ticks, '1h');
    const klines1d = aggregateOHLCV(ticks, '1d');
    const elapsed = Date.now() - start;

    expect(klines1m.length).toBeGreaterThan(klines5m.length);
    expect(klines5m.length).toBeGreaterThan(klines1h.length);
    expect(klines1h.length).toBeGreaterThan(klines1d.length);
    expect(elapsed).toBeLessThan(2000); // 所有聚合应在 2 秒内完成
  });
});

describe('Kline Service - 边界条件', () => {
  test('应正确处理价格相同的 tick', () => {
    const ticks = [
      { time: 1000, price: 100, quantity: 10 },
      { time: 2000, price: 100, quantity: 20 },
      { time: 3000, price: 100, quantity: 30 }
    ];

    const klines = aggregateOHLCV(ticks, '1m');

    expect(klines).toHaveLength(1);
    expect(klines[0].open).toBe(100);
    expect(klines[0].high).toBe(100);
    expect(klines[0].low).toBe(100);
    expect(klines[0].close).toBe(100);
  });

  test('应正确处理单条 tick', () => {
    const ticks = [{ time: 1000, price: 100, quantity: 50 }];

    const klines = aggregateOHLCV(ticks, '1m');

    expect(klines).toHaveLength(1);
    expect(klines[0].open).toBe(100);
    expect(klines[0].high).toBe(100);
    expect(klines[0].low).toBe(100);
    expect(klines[0].close).toBe(100);
    expect(klines[0].volume).toBe(50);
  });

  test('应正确处理跨越多个周期的 tick', () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const ticks = [
      { time: 0, price: 100, quantity: 10 },
      { time: oneDayMs * 3, price: 110, quantity: 20 } // 3天后
    ];

    const klines1d = aggregateOHLCV(ticks, '1d');

    // 应该有 2 根 K线，中间空缺的天数不会有 K线
    expect(klines1d.length).toBeGreaterThanOrEqual(2);
  });
});
