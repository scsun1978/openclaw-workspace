/**
 * RPC 客户端服务 v1.0.0
 * 提供服务间调用的统一封装
 */

const { manager } = require('./circuit-breaker');

/**
 * 服务端点配置
 */
const SERVICE_ENDPOINTS = {
  auth: { host: 'localhost', port: 3001, protocol: 'http' },
  trading: { host: 'localhost', port: 3002, protocol: 'http' },
  market: { host: 'localhost', port: 3003, protocol: 'http' },
  game: { host: 'localhost', port: 3004, protocol: 'http' }
};

/**
 * 重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: 100,
  backoffMultiplier: 2,
  maxBackoffMs: 5000
};

/**
 * RPC 客户端
 */
class RpcClient {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.endpoint = SERVICE_ENDPOINTS[serviceName] || { host: 'localhost', port: 3000 };
    this.timeout = options.timeout || 5000;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry };
    
    // 获取该服务的熔断器
    this.circuitBreaker = manager.getBreaker(`rpc:${serviceName}`, {
      failureThreshold: 5,
      timeout: 5000,
      resetTimeout: 30000
    });

    // 调用统计
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalLatency: 0,
      latencySamples: []
    };
  }

  /**
   * 执行 RPC 调用
   */
  async call(method, params = {}, options = {}) {
    const startTime = Date.now();
    this.stats.totalCalls++;

    const retryConfig = { ...this.retryConfig, ...options.retry };
    let lastError = null;
    let attempt = 0;

    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      
      try {
        const result = await this.circuitBreaker.execute(async () => {
          return await this.doCall(method, params, options);
        });

        // 记录成功
        const latency = Date.now() - startTime;
        this.recordLatency(latency);
        this.stats.successCalls++;

        return result;
      } catch (error) {
        lastError = error;
        
        // 如果是熔断器拒绝，不重试
        if (error.message.includes('Circuit breaker') && error.message.includes('OPEN')) {
          this.stats.failedCalls++;
          throw error;
        }

        // 计算退避时间
        if (attempt < retryConfig.maxAttempts) {
          const backoff = Math.min(
            retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxBackoffMs
          );
          await this.sleep(backoff);
        }
      }
    }

    // 所有重试失败
    this.stats.failedCalls++;
    throw lastError;
  }

  /**
   * 实际执行调用 (模拟)
   */
  async doCall(method, params, options) {
    // 模拟网络延迟
    const latency = options.simulatedLatency || Math.random() * 10 + 1;
    await this.sleep(latency);

    // 模拟成功/失败
    if (options.simulateFailure) {
      throw new Error(`Simulated failure for ${this.serviceName}.${method}`);
    }

    // 模拟响应
    return {
      service: this.serviceName,
      method,
      params,
      latency,
      timestamp: Date.now()
    };
  }

  /**
   * 记录延迟
   */
  recordLatency(latency) {
    this.stats.totalLatency += latency;
    this.stats.latencySamples.push(latency);
    
    // 保留最近 100 个样本
    if (this.stats.latencySamples.length > 100) {
      this.stats.latencySamples.shift();
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const samples = this.stats.latencySamples;
    const avgLatency = samples.length > 0 
      ? samples.reduce((a, b) => a + b, 0) / samples.length 
      : 0;
    
    const p99 = samples.length > 0 
      ? samples.sort((a, b) => a - b)[Math.floor(samples.length * 0.99)] || 0
      : 0;

    return {
      serviceName: this.serviceName,
      totalCalls: this.stats.totalCalls,
      successCalls: this.stats.successCalls,
      failedCalls: this.stats.failedCalls,
      avgLatency: avgLatency.toFixed(2),
      p99Latency: p99.toFixed(2),
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  /**
   * 批量调用
   */
  async batchCall(calls) {
    return await Promise.all(
      calls.map(({ method, params }) => this.call(method, params))
    );
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.call('health', {}, { timeout: 1000 });
      return { healthy: true, serviceName: this.serviceName };
    } catch (error) {
      return { healthy: false, serviceName: this.serviceName, error: error.message };
    }
  }

  /**
   * 休眠
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * RPC 客户端管理器
 */
class RpcClientManager {
  constructor() {
    this.clients = new Map();
  }

  /**
   * 获取或创建客户端
   */
  getClient(serviceName, options = {}) {
    if (!this.clients.has(serviceName)) {
      this.clients.set(serviceName, new RpcClient(serviceName, options));
    }
    return this.clients.get(serviceName);
  }

  /**
   * 获取所有客户端统计
   */
  getAllStats() {
    const stats = {};
    for (const [name, client] of this.clients) {
      stats[name] = client.getStats();
    }
    return stats;
  }
}

// 单例管理器
const rpcManager = new RpcClientManager();

module.exports = {
  RpcClient,
  RpcClientManager,
  SERVICE_ENDPOINTS,
  rpcManager
};
