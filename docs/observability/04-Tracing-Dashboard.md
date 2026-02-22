# Tracing Dashboard

> **Dashboard UID**: `openclaw-tracing`  
> **访问地址**: http://localhost:3000/d/openclaw-tracing  
> **Jaeger UI**: http://localhost:16686

## 用途

分布式链路追踪，用于分析请求的**完整调用链**和**延迟分布**。

## 架构说明

```
OpenClaw Gateway
       │
       ▼ OTLP (4317/4318)
   ┌───────┐
   │ Alloy │ ← 采集 Trace 数据
   └───┬───┘
       │ OTLP (14317)
       ▼
   ┌───────┐
   │Jaeger │ ← 存储和查询 Traces
   └───────┘
       │
       ▼
   Grafana Dashboard
```

## 面板说明

### 顶部链接

- **🔍 Open Jaeger UI**: 跳转到 Jaeger 原生界面查看详细 Trace

### 统计卡片

| 面板 | 含义 | 用途 |
|------|------|------|
| 📊 Services Monitored | 监控的服务数 | 确认所有服务已接入 |
| 📈 Spans Received (5m) | 5分钟接收的 Span 数 | 监控 Trace 数据量 |
| 📤 Spans Exported (5m) | 5分钟导出的 Span 数 | 确认数据正常导出 |
| 💾 Total Memory | 系统总内存 | 资源监控 |

### 趋势图

#### 📈 Trace Throughput (Spans/min)
- **Received**: 接收的 Spans
- **Exported**: 导出的 Spans
- **用途**: 监控 Trace 数据吞吐量

#### 📦 Batch Processing Stats
- **Batches/min**: 批处理频率
- **Avg Batch Size**: 平均批量大小
- **用途**: 优化批处理配置

#### ⚠️ Trace Errors
- **Refused**: 被拒绝的 Spans
- **Failed**: 失败的 Spans
- **Send Failed**: 发送失败的 Spans
- **用途**: 监控 Trace 数据丢失

#### 📊 Exporter Queue Status
- **Queue Size**: 当前队列大小
- **Queue Capacity**: 队列容量
- **用途**: 监控队列是否积压

#### 📝 Loki Log Export Rate
- **Entries/sec**: 日志导出速率
- **用途**: 监控日志与 Trace 关联

#### 📝 Recent Logs
- 带潜在 Trace 上下文的日志
- 用于日志与 Trace 关联分析

## Jaeger UI 使用

### 访问方式
```
http://localhost:16686
```

### 常用操作

1. **搜索 Trace**
   - 选择 Service: `openclaw-gateway`
   - 设置时间范围
   - 点击 "Find Traces"

2. **查看 Trace 详情**
   - 点击任意 Trace
   - 查看火焰图
   - 分析各 Span 耗时

3. **对比 Trace**
   - 选择多个 Trace
   - 点击 "Compare"
   - 分析性能差异

4. **搜索特定操作**
   - 在 Search 面板输入 Operation
   - 如: `tool_call`, `llm_request`

## Trace 分析场景

### 场景 1: 请求延迟分析
1. 在 Jaeger 搜索慢请求
2. 查看 Trace 火焰图
3. 找出耗时最长的 Span
4. 优化对应组件

### 场景 2: 错误追踪
1. 在 Jaeger 搜索有错误的 Trace
2. 查看错误 Span 详情
3. 分析错误原因
4. 修复问题

### 场景 3: 调用链分析
1. 查看 Trace 完整调用链
2. 分析 Span 依赖关系
3. 识别瓶颈节点
4. 优化调用路径

## 已知限制

### Grafana Jaeger 插件兼容性

**问题**: Grafana 12.3.3 的 Jaeger 插件与 Jaeger 后端存在兼容性问题

**表现**: Traces 面板显示 "No Data"

**解决方案**:
1. 使用 Jaeger UI 直接查看 (http://localhost:16686)
2. 使用 Dashboard 中的 "Open Jaeger UI" 链接

### Trace 数据量

**当前状态**: 只有测试 Trace 数据

**原因**: OpenClaw Gateway 需要启用 OTLP 导出

**建议**: 在 Gateway 中添加 OpenTelemetry instrumentation

## 配置文件

### Alloy 配置
```alloy
// /opt/homebrew/etc/grafana-alloy/config.alloy

otelcol.receiver.otlp "default" {
  grpc { endpoint = "127.0.0.1:4317" }
  http { endpoint = "127.0.0.1:4318" }
  
  output {
    traces = [otelcol.processor.batch.default.input]
  }
}

otelcol.processor.batch "default" {
  timeout = "5s"
  send_batch_size = 1024
  
  output {
    traces = [otelcol.exporter.otlp.jaeger.input]
  }
}

otelcol.exporter.otlp "jaeger" {
  client {
    endpoint = "127.0.0.1:14317"
    tls { insecure = true }
  }
}
```

## 相关 Dashboard

- 系统概览 → [[01-Overview-Dashboard]]
- 错误分析 → [[02-Error-Analysis-Dashboard]]
- 性能基线 → [[07-Performance-Dashboard]]

---
#OpenClaw #Dashboard #Tracing #Jaeger
