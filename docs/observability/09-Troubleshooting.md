# OpenClaw Observability 故障排查指南

> **版本**: v1.0  
> **更新日期**: 2026-02-22

## 快速诊断流程

```
┌─────────────────────────────────────────────────────┐
│                   发现问题                           │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  1. 检查 [[01-Overview-Dashboard]]                  │
│     - Services Up = 5?                              │
│     - Errors 有增加?                                │
└───────────────────────┬─────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ 服务异常      │       │ 错误增加      │
    └───────┬───────┘       └───────┬───────┘
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ 检查服务状态  │       │ [[02-Error-   │
    │ brew services │       │ Analysis]]    │
    └───────────────┘       └───────────────┘
```

## 常见问题

### 1. Dashboard 显示 "No Data"

**症状**: Grafana 面板显示 "No Data"

**可能原因**:
1. 数据源连接失败
2. 查询语法错误
3. 数据采集器停止

**排查步骤**:

```bash
# 1. 检查数据源
curl -u admin:admin -X POST http://localhost:3000/api/datasources/1/health
curl -u admin:admin -X POST http://localhost:3000/api/datasources/2/health

# 2. 检查 VictoriaMetrics
curl http://localhost:8428/health

# 3. 检查 Loki
curl http://localhost:3100/ready

# 4. 检查 Alloy
curl http://localhost:12345/-/healthy
```

**解决方案**:
- 重启对应服务
- 检查配置文件
- 验证查询语法

### 2. 服务无法启动

**症状**: brew services 显示服务状态为 error

**排查步骤**:

```bash
# 查看服务状态
brew services list

# 查看错误日志
tail -50 /opt/homebrew/var/log/<service>.log

# 尝试手动启动
/opt/homebrew/opt/<service>/bin/<service>
```

**常见错误**:

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 端口被占用 | 其他进程占用端口 | `lsof -i :<port>` 找到并终止 |
| 配置错误 | 配置文件语法错误 | 检查配置文件 |
| 权限问题 | 数据目录无写权限 | `chmod` 或 `chown` |

### 3. Provider Cooldown 频繁

**症状**: Error Analysis 显示大量 cooldown 事件

**诊断**:

```bash
# 查看最近 cooldown 日志
grep "cooldown" ~/.openclaw/logs/gateway.log | tail -20
```

**可能原因**:
1. API 配额不足
2. 请求频率过高
3. Provider 服务不稳定

**解决方案**:
1. 检查 API 配额使用情况
2. 降低请求频率
3. 添加更多 Provider 分流
4. 增加 cooldown 恢复时间

### 4. 日志采集中断

**症状**: Loki 查询无数据或数据不完整

**排查步骤**:

```bash
# 1. 检查日志文件是否存在
ls -la ~/.openclaw/logs/

# 2. 检查 Alloy 是否运行
curl http://localhost:12345/-/healthy

# 3. 检查 Loki 是否正常
curl http://localhost:3100/ready

# 4. 检查 Loki 接收的数据
curl -sG http://localhost:3100/loki/api/v1/labels
```

**解决方案**:
- 重启 Alloy: `brew services restart grafana-alloy`
- 检查 Alloy 配置: `/opt/homebrew/etc/grafana-alloy/config.alloy`
- 检查日志文件路径是否正确

### 5. 内存不足

**症状**: Free Memory < 10%, 系统变慢

**诊断**:

```bash
# 查看内存使用
top -l 1 | head -10

# 查看进程内存
ps aux --sort=-%mem | head -10

# 查看组件内存
curl http://localhost:8428/api/v1/query?query=process_resident_memory_bytes | jq .
```

**解决方案**:
1. 重启高内存进程
2. 调整组件内存限制
3. 增加数据清理频率
4. 考虑增加物理内存

### 6. Trace 数据丢失

**症状**: Tracing Dashboard 无数据

**排查步骤**:

```bash
# 1. 检查 Jaeger 是否运行
curl http://localhost:16686/api/services

# 2. 检查 Alloy OTLP 接收器
curl http://localhost:12345/api/v0/components | jq '.components[] | select(.name | contains("otelcol"))'

# 3. 检查 OTelcol 指标
curl http://localhost:8428/api/v1/query?query=otelcol_receiver_accepted_spans_total
```

**解决方案**:
- 重启 Jaeger
- 重启 Alloy
- 检查 OTLP 端口配置

### 7. Grafana 无法登录

**症状**: 登录失败或密码错误

**解决方案**:

```bash
# 重置 admin 密码
grafana-cli admin reset-admin-password <new_password>

# 或通过 API
curl -X PUT -u admin:admin http://localhost:3000/api/admin/users/1/password \
  -d '{"password":"new_password"}'
```

## 错误代码速查

| 错误代码 | 含义 | 常见原因 | 处理方法 |
|----------|------|----------|----------|
| UNAVAILABLE | 服务不可用 | Provider cooldown, 网络问题 | 检查 Provider 状态 |
| INVALID_REQUEST | 请求无效 | 参数错误, 认证失败 | 检查请求参数 |
| TIMEOUT | 请求超时 | 响应慢, 网络延迟 | 增加超时时间 |
| INTERNAL | 内部错误 | 程序 bug, 资源不足 | 查看日志排查 |

## 紧急恢复

### 完全重启所有服务

```bash
# 停止所有服务
brew services stop grafana
brew services stop victoriametrics
brew services stop loki
brew services stop grafana-alloy
brew services stop node_exporter

# 等待 5 秒
sleep 5

# 按顺序启动
brew services start victoriametrics
sleep 3
brew services start loki
sleep 3
brew services start grafana-alloy
sleep 3
brew services start grafana
brew services start node_exporter
```

### 恢复到上一个配置

```bash
# 如果有备份
tar -xzf openclaw-obs-config-YYYYMMDD.tar.gz -C /

# 重启服务
brew services restart grafana
brew services restart grafana-alloy
```

## 日志分析技巧

### 查找特定错误

```bash
# 查找最近 100 条错误
grep -i "error" ~/.openclaw/logs/gateway.log | tail -100

# 查找特定错误码
grep "errorCode=" ~/.openclaw/logs/gateway.log | tail -50

# 查找超时错误
grep -i "timeout" ~/.openclaw/logs/gateway.log | tail -50
```

### 统计错误分布

```bash
# 按组件统计错误
grep "error" ~/.openclaw/logs/gateway.log | \
  sed 's/.*\[//' | sed 's/\].*//' | sort | uniq -c | sort -rn
```

## 性能调优

### VictoriaMetrics 优化

```bash
# 增加 cache 大小
# 在启动参数中添加
-storageDataPath=/path/to/data
-retentionPeriod=90d
-memory.allowedPercent=50
```

### Loki 优化

```yaml
# loki-config.yaml
limits_config:
  max_entries_limit_per_query: 5000
  max_query_series: 500
```

### Alloy 优化

```alloy
// 增加批量大小
otelcol.processor.batch "default" {
  timeout = "10s"
  send_batch_size = 2048
}
```

## 联系支持

如果以上方法无法解决问题：

1. 收集诊断信息：
   ```bash
   # 收集系统状态
   brew services list > diagnostic.txt
   curl http://localhost:8428/api/v1/query?query=up >> diagnostic.txt
   tail -100 ~/.openclaw/logs/gateway.log >> diagnostic.txt
   ```

2. 记录问题：
   - 问题现象
   - 发生时间
   - 已尝试的解决方法

3. 提交 Issue 或联系开发团队

## 相关文档

- [[08-Operations-Guide]] - 运维手册
- [[01-Overview-Dashboard]] - 概览 Dashboard
- [[02-Error-Analysis-Dashboard]] - 错误分析 Dashboard

---
#OpenClaw #Troubleshooting #DevOps
