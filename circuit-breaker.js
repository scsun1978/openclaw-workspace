/**
 * 熔断器服务 v1.0.0
 * 实现服务容错的熔断模式
 */

/**
 * 熔断器状态
 */
const CircuitState = {
  CLOSED: 'CLOSED',     // 正常状态，允许请求
  OPEN: 'OPEN',         // 熔断状态，拒绝请求
  HALF_OPEN: 'HALF_OPEN' // 半开状态，允许探测请求
};

/**
 * 熔断器类
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 5000; // 熔断持续时间
    this.resetTimeout = options.resetTimeout || 30000; // 重置超时
    
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    
    // 统计
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: 0
    };
  }

  /**
   * 执行受保护的调用
   */
  async execute(fn) {
    this.stats.totalCalls++;

    // 检查是否应该尝试恢复
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        this.stats.rejectedCalls++;
        throw new Error(`Circuit breaker [${this.name}] is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 成功回调
   */
  onSuccess() {
    this.stats.successfulCalls++;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * 失败回调
   */
  onFailure() {
    this.stats.failedCalls++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * 状态转换
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.stats.stateChanges++;
    
    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    }

    console.log(`[CircuitBreaker:${this.name}] State changed: ${oldState} -> ${newState}`);
  }

  /**
   * 强制打开熔断器
   */
  trip() {
    this.transitionTo(CircuitState.OPEN);
    this.lastFailureTime = Date.now();
  }

  /**
   * 强制关闭熔断器
   */
  reset() {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      uptime: Date.now() - this.lastStateChange
    };
  }

  /**
   * 检查是否允许请求
   */
  isAllowed() {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.HALF_OPEN) return true;
    if (this.state === CircuitState.OPEN) {
      return Date.now() - this.lastFailureTime >= this.timeout;
    }
    return false;
  }
}

/**
 * 熔断器管理器
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * 获取或创建熔断器
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStats() {
    const stats = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// 单例管理器
const manager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  manager
};
