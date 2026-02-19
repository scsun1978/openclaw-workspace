/**
 * 多级缓存服务 v1.0.0
 * L1: 本地内存缓存 (node-cache 风格)
 * L2: Redis 缓存 (Mock)
 */

/**
 * L1 本地缓存实现
 */
class LocalCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.defaultTTL = options.defaultTTL || 60000; // 默认 1 分钟
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * 设置缓存
   */
  set(key, value, ttl = this.defaultTTL) {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      lastAccess: Date.now()
    });
    this.stats.sets++;

    return true;
  }

  /**
   * 获取缓存
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问时间 (LRU)
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * 清空缓存
   */
  flush() {
    this.cache.clear();
    return true;
  }

  /**
   * 获取统计
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * 预热缓存
   */
  async warmup(dataLoader) {
    const data = await dataLoader();
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
    return Object.keys(data).length;
  }
}

/**
 * L2 Redis 缓存 Mock
 */
class RedisCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  async get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  async set(key, value, ttl = 300) {
    this.cache.set(key, value);
    this.stats.sets++;
    return true;
  }

  async delete(key) {
    return this.cache.delete(key);
  }

  getStats() {
    return { ...this.stats, size: this.cache.size };
  }
}

/**
 * 多级缓存管理器
 */
class TieredCache {
  constructor(options = {}) {
    this.l1 = new LocalCache(options.l1);
    this.l2 = new RedisCache();
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      totalRequests: 0
    };
  }

  /**
   * 获取数据 (L1 -> L2 -> DataLoader)
   */
  async get(key, dataLoader = null) {
    this.stats.totalRequests++;

    // 1. 尝试 L1
    const l1Value = this.l1.get(key);
    if (l1Value !== null) {
      this.stats.l1Hits++;
      return l1Value;
    }

    // 2. 尝试 L2
    const l2Value = await this.l2.get(key);
    if (l2Value !== null) {
      this.stats.l2Hits++;
      // 回填 L1
      this.l1.set(key, l2Value);
      return l2Value;
    }

    // 3. 从数据源加载
    if (dataLoader) {
      const value = await dataLoader();
      if (value !== null) {
        // 写入 L1 和 L2
        this.l1.set(key, value);
        await this.l2.set(key, value);
        return value;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 设置数据
   */
  async set(key, value, ttl = 60000) {
    this.l1.set(key, value, ttl);
    await this.l2.set(key, value, Math.ceil(ttl / 1000));
    return true;
  }

  /**
   * 删除数据
   */
  async delete(key) {
    this.l1.delete(key);
    await this.l2.delete(key);
    return true;
  }

  /**
   * 获取综合统计
   */
  getStats() {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const hitRate = this.stats.totalRequests > 0
      ? (totalHits / this.stats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      l1Hits: this.stats.l1Hits,
      l2Hits: this.stats.l2Hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      l1: this.l1.getStats(),
      l2: this.l2.getStats()
    };
  }

  /**
   * 预热热点数据
   */
  async warmup(hotKeys, dataLoader) {
    let count = 0;
    for (const key of hotKeys) {
      const value = await dataLoader(key);
      if (value !== null) {
        await this.set(key, value);
        count++;
      }
    }
    return count;
  }
}

/**
 * 缓存穿透/击穿保护
 */
class CacheProtection {
  constructor(cache) {
    this.cache = cache;
    this.bloomFilter = new Set(); // 简化版布隆过滤器
    this.requestLocks = new Map(); // 防止缓存击穿
  }

  /**
   * 安全获取（防击穿）
   */
  async get(key, dataLoader) {
    // 检查布隆过滤器
    if (!this.bloomFilter.has(key)) {
      return null;
    }

    // 检查是否有正在进行的请求
    if (this.requestLocks.has(key)) {
      // 等待现有请求完成
      return await this.requestLocks.get(key);
    }

    // 创建请求锁
    const promise = this._loadWithCache(key, dataLoader);
    this.requestLocks.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.requestLocks.delete(key);
    }
  }

  async _loadWithCache(key, dataLoader) {
    const cached = await this.cache.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await dataLoader();
    if (value !== null) {
      await this.cache.set(key, value);
      this.bloomFilter.add(key);
    }

    return value;
  }

  /**
   * 添加到白名单
   */
  addToBloomFilter(key) {
    this.bloomFilter.add(key);
  }
}

module.exports = {
  LocalCache,
  RedisCache,
  TieredCache,
  CacheProtection
};
