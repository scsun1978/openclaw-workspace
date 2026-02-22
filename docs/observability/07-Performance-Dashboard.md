# Performance Dashboard

> **Dashboard UID**: `openclaw-performance`  
> **访问地址**: http://localhost:3000/d/openclaw-performance

## 用途

建立 OpenClaw 的**性能基线**，用于性能对比和优化。

## 核心指标

| 指标 | 含义 | 基线值 |
|------|------|--------|
| Response Time P50 | 中位数响应时间 | < 100ms |
| Response Time P99 | 99 分位响应时间 | < 500ms |
| Throughput | 吞吐量 | 取决于硬件 |
| CPU Usage | CPU 使用率 | < 80% |
| Memory Usage | 内存使用率 | < 80% |

## 使用场景

### 场景 1: 性能基线建立
- 记录正常运行时的性能指标
- 作为后续对比的基准

### 场景 2: 性能回归检测
- 对比当前性能与基线
- 发现性能下降

### 场景 3: 优化效果验证
- 对比优化前后性能
- 量化改进效果

---
#OpenClaw #Dashboard #Performance
