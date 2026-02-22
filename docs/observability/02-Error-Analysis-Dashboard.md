# Error Analysis Dashboard

> **Dashboard UID**: `openclaw-errors`  
> **访问地址**: http://localhost:3000/d/openclaw-errors

## 用途

专门用于**错误监控与分析**，帮助快速定位和诊断 OpenClaw 运行中的问题。

## 面板说明

### 📊 错误概览

| 面板 | 含义 | 正常值 | 异常处理 |
|------|------|--------|----------|
| 🔴 Errors (5m) | 5分钟错误数 | < 10 | > 50 需立即处理 |
| 🔴 Errors (1h) | 1小时错误数 | < 50 | > 200 需分析趋势 |
| 🔴 Errors (24h) | 24小时错误数 | 基线参考 | 对比历史趋势 |
| ⚠️ Services Down | 宕机服务数 | 0 | > 0 立即恢复 |

### 🔌 Provider & LLM 错误

| 面板 | 含义 | 常见原因 |
|------|------|----------|
| 🔄 Cooldown Events | Provider 冷却次数 | API 配额超限、请求过快 |
| ⏱️ Session Timeout | 会话超时次数 | Agent 响应慢、网络问题 |
| 🚫 All Models Failed | 所有模型失败 | 所有 Provider 同时不可用 |
| 🔧 Exec Failed | 命令执行失败 | 权限问题、命令错误 |

### 错误趋势图

#### 🔄 Provider Cooldown Trend
- **用途**: 各 Provider 的 cooldown 频率
- **显示**: openai-codex, zai/glm-5, google-antigravity
- **诊断**: 
  - 单一 Provider 高 → 检查该 Provider 配额
  - 多个 Provider 高 → 整体请求量过大

#### ⏱️ Timeout & LLM Error Trend
- **用途**: 超时和 API 错误趋势
- **诊断**: 
  - Timeout 上升 → 网络问题或后端负载高
  - API Errors 上升 → 检查 Provider 状态

### 日志面板

#### 🔴 Error Logs (Live)
- 实时错误日志流
- 按 `level="error"` 过滤

#### 🔌 Provider/LLM Error Logs
- Provider 相关错误
- 包含: cooldown, All models failed, timed out

#### 🔍 Error Code Logs
- 包含 errorCode 的日志
- 常见错误码: UNAVAILABLE, INVALID_REQUEST

## 常见错误诊断

### 错误码: UNAVAILABLE
**含义**: 服务不可用  
**常见原因**:
- Provider cooldown (API 限流)
- 网络连接问题
- Provider 服务宕机

**处理步骤**:
1. 检查是哪个 Provider
2. 查看 Cooldown Events 面板
3. 考虑切换到备用 Provider

### 错误码: INVALID_REQUEST
**含义**: 请求无效  
**常见原因**:
- 请求参数错误
- 不支持的 API 调用
- 认证问题

**处理步骤**:
1. 查看具体日志内容
2. 检查请求参数
3. 验证 API Key 配置

### FailoverError: LLM request timed out
**含义**: LLM 请求超时  
**常见原因**:
- 模型响应慢
- 网络延迟
- 请求队列积压

**处理步骤**:
1. 检查网络连接
2. 考虑增加超时时间
3. 分流请求到其他 Provider

### All models failed (4)
**含义**: 所有备用模型都失败  
**严重级别**: 高

**处理步骤**:
1. 立即检查各 Provider 状态
2. 检查 API Key 是否有效
3. 检查配额是否耗尽
4. 考虑添加更多 Provider

## 运维场景

### 场景 1: 错误突增
1. 查看 Error Rate Trend 定位时间点
2. 查看 Errors by Component 确定组件
3. 查看 Error Logs 找具体错误
4. 根据错误类型处理

### 场景 2: Provider 问题
1. 查看 Cooldown Trend
2. 查看 Provider/LLM Error Logs
3. 确定是哪个 Provider
4. 检查配额或联系 Provider

### 场景 3: 性能下降
1. 查看 Timeout Trend
2. 查看 Session Timeout 数
3. 结合 Tracing Dashboard 分析延迟

## 告警建议

| 条件 | 级别 | 通知方式 |
|------|------|----------|
| Errors (5m) > 50 | 严重 | 立即通知 |
| Cooldown Events > 100/h | 警告 | 记录 + 通知 |
| All Models Failed > 0 | 严重 | 立即通知 |
| Services Down > 0 | 紧急 | 立即电话 |

## 相关 Dashboard

- 系统概览 → [[01-Overview-Dashboard]]
- Agent 问题 → [[03-Token-Agent-Dashboard]]
- 性能问题 → [[04-Tracing-Dashboard]]

---
#OpenClaw #Dashboard #Errors #Troubleshooting
