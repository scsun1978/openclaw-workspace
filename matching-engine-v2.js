/**
 * 优化撮合引擎 v1.0.0
 * 细粒度锁 + 异步事件解耦
 */

/**
 * 细粒度锁管理器
 */
class LockManager {
  constructor() {
    this.symbolLocks = new Map(); // 按股票代码分锁
    this.globalLock = { locked: false, queue: [] };
    this.stats = {
      acquisitions: 0,
      releases: 0,
      contentions: 0
    };
  }

  /**
   * 获取股票锁
   */
  async acquireSymbolLock(symbol) {
    if (!this.symbolLocks.has(symbol)) {
      this.symbolLocks.set(symbol, { locked: false, queue: [] });
    }

    const lock = this.symbolLocks.get(symbol);
    
    if (!lock.locked) {
      lock.locked = true;
      this.stats.acquisitions++;
      return true;
    }

    // 等待锁释放
    this.stats.contentions++;
    return new Promise(resolve => {
      lock.queue.push(resolve);
    });
  }

  /**
   * 释放股票锁
   */
  releaseSymbolLock(symbol) {
    const lock = this.symbolLocks.get(symbol);
    if (!lock) return false;

    if (lock.queue.length > 0) {
      const next = lock.queue.shift();
      next(true);
    } else {
      lock.locked = false;
    }

    this.stats.releases++;
    return true;
  }

  /**
   * 批量获取锁
   */
  async acquireMultiple(symbols) {
    const sorted = [...symbols].sort();
    for (const symbol of sorted) {
      await this.acquireSymbolLock(symbol);
    }
    return true;
  }

  /**
   * 批量释放锁
   */
  releaseMultiple(symbols) {
    for (const symbol of symbols) {
      this.releaseSymbolLock(symbol);
    }
    return true;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      ...this.stats,
      activeLocks: Array.from(this.symbolLocks.entries())
        .filter(([_, lock]) => lock.locked).length,
      totalLocks: this.symbolLocks.size,
      contentionRate: this.stats.acquisitions > 0
        ? (this.stats.contentions / this.stats.acquisitions * 100).toFixed(2)
        : 0
    };
  }
}

/**
 * 异步事件队列
 */
class AsyncEventQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.handlers = new Map();
    this.stats = {
      published: 0,
      processed: 0,
      failed: 0
    };
  }

  /**
   * 发布事件（非阻塞）
   */
  publish(eventType, data) {
    this.queue.push({ eventType, data, timestamp: Date.now() });
    this.stats.published++;

    // 触发异步处理
    if (!this.processing) {
      setImmediate(() => this.process());
    }

    return true;
  }

  /**
   * 处理队列
   */
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift();
      
      try {
        const handlers = this.handlers.get(event.eventType) || [];
        for (const handler of handlers) {
          await handler(event.data);
        }
        this.stats.processed++;
      } catch (error) {
        this.stats.failed++;
      }
    }

    this.processing = false;
  }

  /**
   * 订阅事件
   */
  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      isProcessing: this.processing
    };
  }
}

/**
 * 订单簿（单只股票）
 */
class OrderBook {
  constructor(symbol) {
    this.symbol = symbol;
    this.bids = []; // 买单（价格降序）
    this.asks = []; // 卖单（价格升序）
    this.version = 0;
  }

  /**
   * 添加订单
   */
  addOrder(order) {
    const { side, price, quantity } = order;
    
    if (side === 'buy') {
      this.bids.push({ ...order, timestamp: Date.now() });
      this.bids.sort((a, b) => b.price - a.price);
    } else {
      this.asks.push({ ...order, timestamp: Date.now() });
      this.asks.sort((a, b) => a.price - b.price);
    }
    
    this.version++;
    return true;
  }

  /**
   * 获取最优买价
   */
  getBestBid() {
    return this.bids[0] || null;
  }

  /**
   * 获取最优卖价
   */
  getBestAsk() {
    return this.asks[0] || null;
  }

  /**
   * 匹配订单
   */
  match(newOrder) {
    const matches = [];
    let remaining = newOrder.quantity;

    const oppositeOrders = newOrder.side === 'buy' ? this.asks : this.bids;

    for (let i = 0; i < oppositeOrders.length && remaining > 0; i++) {
      const order = oppositeOrders[i];
      const canMatch = newOrder.side === 'buy'
        ? newOrder.price >= order.price
        : newOrder.price <= order.price;

      if (!canMatch) break;

      const matchQuantity = Math.min(remaining, order.quantity);
      matches.push({
        buyOrderId: newOrder.side === 'buy' ? newOrder.id : order.id,
        sellOrderId: newOrder.side === 'sell' ? newOrder.id : order.id,
        price: order.price,
        quantity: matchQuantity
      });

      remaining -= matchQuantity;
      order.quantity -= matchQuantity;
    }

    // 移除完全成交的订单
    if (newOrder.side === 'buy') {
      this.asks = this.asks.filter(o => o.quantity > 0);
    } else {
      this.bids = this.bids.filter(o => o.quantity > 0);
    }

    this.version++;
    return { matches, remaining };
  }

  /**
   * 获取深度
   */
  getDepth(levels = 5) {
    return {
      bids: this.bids.slice(0, levels).map(o => ({ price: o.price, quantity: o.quantity })),
      asks: this.asks.slice(0, levels).map(o => ({ price: o.price, quantity: o.quantity }))
    };
  }
}

/**
 * 优化撮合引擎
 */
class OptimizedMatchingEngine {
  constructor() {
    this.orderBooks = new Map();
    this.lockManager = new LockManager();
    this.eventQueue = new AsyncEventQueue();
    this.stats = {
      ordersProcessed: 0,
      tradesExecuted: 0,
      totalVolume: 0
    };

    // 订阅异步事件
    this.eventQueue.subscribe('trade', (trade) => {
      this.stats.tradesExecuted++;
      this.stats.totalVolume += trade.quantity;
    });

    this.eventQueue.subscribe('notification', async (data) => {
      // 异步推送通知
      await this.delay(1);
    });

    this.eventQueue.subscribe('achievement', async (data) => {
      // 异步成就检查
      await this.delay(1);
    });
  }

  /**
   * 获取或创建订单簿
   */
  getOrderBook(symbol) {
    if (!this.orderBooks.has(symbol)) {
      this.orderBooks.set(symbol, new OrderBook(symbol));
    }
    return this.orderBooks.get(symbol);
  }

  /**
   * 处理订单（带细粒度锁）
   */
  async processOrder(order) {
    const { symbol } = order;

    // 获取该股票的锁
    await this.lockManager.acquireSymbolLock(symbol);

    try {
      const orderBook = this.getOrderBook(symbol);

      // 匹配订单
      const { matches, remaining } = orderBook.match(order);

      // 发布交易事件（异步）
      for (const match of matches) {
        this.eventQueue.publish('trade', match);
        this.eventQueue.publish('notification', {
          type: 'trade',
          ...match
        });
      }

      // 如果有剩余，添加到订单簿
      if (remaining > 0) {
        orderBook.addOrder({ ...order, quantity: remaining });
      }

      this.stats.ordersProcessed++;

      return {
        success: true,
        matches: matches.length,
        remaining
      };
    } finally {
      // 释放锁
      this.lockManager.releaseSymbolLock(symbol);
    }
  }

  /**
   * 批量处理订单（并行）
   */
  async processBatch(orders) {
    // 按股票分组
    const grouped = new Map();
    for (const order of orders) {
      if (!grouped.has(order.symbol)) {
        grouped.set(order.symbol, []);
      }
      grouped.get(order.symbol).push(order);
    }

    // 并行处理不同股票的订单
    const results = await Promise.all(
      Array.from(grouped.values()).map(async (symbolOrders) => {
        const results = [];
        for (const order of symbolOrders) {
          results.push(await this.processOrder(order));
        }
        return results;
      })
    );

    return results.flat();
  }

  /**
   * 获取行情快照
   */
  getMarketSnapshot(symbols) {
    const snapshot = {};
    for (const symbol of symbols) {
      const orderBook = this.orderBooks.get(symbol);
      if (orderBook) {
        snapshot[symbol] = {
          bestBid: orderBook.getBestBid()?.price || null,
          bestAsk: orderBook.getBestAsk()?.price || null,
          depth: orderBook.getDepth()
        };
      }
    }
    return snapshot;
  }

  /**
   * 获取综合统计
   */
  getStats() {
    return {
      engine: this.stats,
      locks: this.lockManager.getStats(),
      events: this.eventQueue.getStats(),
      symbols: this.orderBooks.size
    };
  }

  /**
   * 延迟辅助函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  LockManager,
  AsyncEventQueue,
  OrderBook,
  OptimizedMatchingEngine
};
