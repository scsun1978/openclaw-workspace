/**
 * 事件总线服务 v1.0.0
 * 基于 Redis Streams 的异步消息传递
 */

/**
 * 模拟 Redis Streams 客户端
 */
class MockRedisStream {
  constructor() {
    this.streams = new Map();
    this.consumers = new Map();
    this.consumerGroups = new Map();
  }

  /**
   * 添加消息到流
   */
  async xadd(streamKey, id, fields) {
    if (!this.streams.has(streamKey)) {
      this.streams.set(streamKey, []);
    }
    
    const messageId = id === '*' ? `${Date.now()}-0` : id;
    const message = {
      id: messageId,
      fields,
      timestamp: Date.now()
    };
    
    this.streams.get(streamKey).push(message);
    return messageId;
  }

  /**
   * 读取流消息
   */
  async xrange(streamKey, start, end, count) {
    const messages = this.streams.get(streamKey) || [];
    return messages.slice(0, count);
  }

  /**
   * 创建消费者组
   */
  async xgroup(command, streamKey, groupName, id) {
    const key = `${streamKey}:${groupName}`;
    if (!this.consumerGroups.has(key)) {
      this.consumerGroups.set(key, {
        streamKey,
        groupName,
        lastDeliveredId: id,
        pending: new Map()
      });
    }
    return 'OK';
  }

  /**
   * 读取消费者组消息
   */
  async xreadgroup(group, consumer, count, block, streams) {
    const [streamKey] = streams;
    const groupKey = `${streamKey}:${group}`;
    const groupInfo = this.consumerGroups.get(groupKey);
    
    if (!groupInfo) return null;
    
    const messages = this.streams.get(streamKey) || [];
    const undelivered = messages.filter(m => m.id > groupInfo.lastDeliveredId);
    
    if (undelivered.length === 0) return null;
    
    const toDeliver = undelivered.slice(0, count);
    groupInfo.lastDeliveredId = toDeliver[toDeliver.length - 1].id;
    
    return [[streamKey, toDeliver]];
  }

  /**
   * 确认消息
   */
  async xack(streamKey, groupName, messageId) {
    const key = `${streamKey}:${groupName}`;
    const groupInfo = this.consumerGroups.get(key);
    if (groupInfo) {
      groupInfo.pending.delete(messageId);
    }
    return 1;
  }

  /**
   * 获取流长度
   */
  async xlen(streamKey) {
    const messages = this.streams.get(streamKey) || [];
    return messages.length;
  }

  /**
   * 删除流
   */
  async del(streamKey) {
    this.streams.delete(streamKey);
    return 1;
  }
}

/**
 * 事件类型定义
 */
const EventTypes = {
  TRADE_EXECUTED: 'trade.executed',
  ORDER_CREATED: 'order.created',
  BALANCE_UPDATED: 'balance.updated',
  HOLDING_CHANGED: 'holding.changed',
  ACHIEVEMENT_UNLOCKED: 'achievement.unlocked',
  USER_REGISTERED: 'user.registered',
  PRICE_UPDATED: 'price.updated'
};

/**
 * 事件总线
 */
class EventBus {
  constructor(redisClient) {
    this.redis = redisClient || new MockRedisStream();
    this.handlers = new Map();
    this.consumerGroups = new Map();
  }

  /**
   * 发布事件
   */
  async publish(eventType, payload) {
    const streamKey = `events:${eventType}`;
    
    const event = {
      event_id: this.generateId(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source: process.env.SERVICE_NAME || 'unknown',
      version: '1.0',
      payload: JSON.stringify(payload)
    };

    const messageId = await this.redis.xadd(streamKey, '*', event);
    
    console.log(`[EventBus] Published: ${eventType} (${messageId})`);
    return { messageId, event };
  }

  /**
   * 订阅事件
   */
  async subscribe(eventType, handler, options = {}) {
    const streamKey = `events:${eventType}`;
    const groupName = options.groupName || 'default-group';
    const consumerName = options.consumerName || `consumer-${Date.now()}`;

    // 注册处理器
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);

    // 创建消费者组
    await this.redis.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
    
    console.log(`[EventBus] Subscribed to ${eventType} (group: ${groupName})`);
    
    return {
      eventType,
      groupName,
      consumerName,
      stop: () => this.unsubscribe(eventType, handler)
    };
  }

  /**
   * 消费消息
   */
  async consume(eventType, options = {}) {
    const streamKey = `events:${eventType}`;
    const groupName = options.groupName || 'default-group';
    const consumerName = options.consumerName || `consumer-${Date.now()}`;
    const count = options.count || 10;

    const result = await this.redis.xreadgroup(
      groupName,
      consumerName,
      count,
      0,
      [streamKey]
    );

    if (!result) return [];

    const messages = result[0]?.[1] || [];
    const processed = [];

    for (const msg of messages) {
      const { id, fields } = msg;
      
      try {
        const event = {
          ...fields,
          payload: JSON.parse(fields.payload)
        };

        // 调用处理器
        const handlers = this.handlers.get(eventType) || [];
        for (const handler of handlers) {
          await handler(event);
        }

        // 确认消息
        await this.redis.xack(streamKey, groupName, id);
        processed.push({ id, success: true });
      } catch (error) {
        console.error(`[EventBus] Error processing ${id}:`, error.message);
        processed.push({ id, success: false, error: error.message });
      }
    }

    return processed;
  }

  /**
   * 取消订阅
   */
  unsubscribe(eventType, handler) {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * 获取事件流长度
   */
  async getStreamLength(eventType) {
    const streamKey = `events:${eventType}`;
    return await this.redis.xlen(streamKey);
  }

  /**
   * 生成唯一 ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清除所有事件
   */
  async clearAll() {
    for (const eventType of Object.values(EventTypes)) {
      const streamKey = `events:${eventType}`;
      await this.redis.del(streamKey);
    }
    this.handlers.clear();
  }
}

module.exports = {
  EventBus,
  EventTypes,
  MockRedisStream
};
