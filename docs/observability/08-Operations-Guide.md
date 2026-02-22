# OpenClaw Observability 运维手册

> **版本**: v1.0  
> **更新日期**: 2026-02-22

## 服务管理

### 服务列表

| 服务 | 命令 | 默认端口 |
|------|------|----------|
| Grafana | `brew services start/stop/restart grafana` | 3000 |
| VictoriaMetrics | `brew services start/stop/restart victoriametrics` | 8428 |
| Loki | `brew services start/stop/restart loki` | 3100 |
| Jaeger | 手动启动 | 16686, 14317 |
| Alloy | `brew services start/stop/restart grafana-alloy` | 12345, 4317 |
| Node Exporter | `brew services start/stop/restart node_exporter` | 9100 |

### 服务状态检查

```bash
# 检查所有服务状态
brew services list | grep -E "grafana|victoria|loki|alloy|node"

# 检查服务健康
curl http://localhost:3000/api/health    # Grafana
curl http://localhost:8428/health        # VictoriaMetrics
curl http://localhost:3100/ready         # Loki
curl http://localhost:12345/-/healthy    # Alloy
curl http://localhost:9100/metrics       # Node Exporter
```

### 启动 Jaeger

```bash
# 使用 nohup 后台启动
nohup /opt/homebrew/opt/jaeger/bin/jaeger-all-in-one \
  --collector.otlp.enabled=true \
  > /opt/homebrew/var/log/jaeger.log 2>&1 &

# 或使用 launchd (推荐)
# 创建 ~/Library/LaunchAgents/com.jaeger.plist
```

## 配置文件位置

| 组件 | 配置文件 |
|------|----------|
| Grafana | `/opt/homebrew/etc/grafana/` |
| VictoriaMetrics | `/opt/homebrew/etc/victoria-metrics/` |
| Loki | `/opt/homebrew/etc/loki-config.yaml` |
| Alloy | `/opt/homebrew/etc/grafana-alloy/config.alloy` |
| Node Exporter | 无配置文件 |

## 日志位置

| 组件 | 日志路径 |
|------|----------|
| Grafana | `/opt/homebrew/var/log/grafana*.log` |
| VictoriaMetrics | `/opt/homebrew/var/log/victoria-metrics*.log` |
| Loki | `/opt/homebrew/var/log/loki.log` |
| Alloy | `/opt/homebrew/var/log/grafana-alloy.log` |
| OpenClaw Gateway | `~/.openclaw/logs/gateway.log` |
| OpenClaw Errors | `~/.openclaw/logs/gateway.err.log` |

## 日常运维任务

### 每日检查

- [ ] 检查 [[01-Overview-Dashboard]] 确认服务正常
- [ ] 检查 [[02-Error-Analysis-Dashboard]] 确认无严重错误
- [ ] 检查内存使用率 < 90%
- [ ] 检查磁盘空间充足

### 每周检查

- [ ] 检查日志文件大小，必要时轮转
- [ ] 检查 VictoriaMetrics 数据存储
- [ ] 检查 Loki 数据存储
- [ ] 检查 Dashboard 是否正常显示数据

### 每月检查

- [ ] 检查并更新组件版本
- [ ] 检查告警规则有效性
- [ ] 清理过期数据
- [ ] 备份配置文件

## 数据管理

### 数据存储位置

| 组件 | 数据目录 |
|------|----------|
| VictoriaMetrics | `/opt/homebrew/var/lib/victoria-metrics/` |
| Loki | `/opt/homebrew/var/lib/loki/` |
| Grafana | `/opt/homebrew/var/lib/grafana/` |

### 数据保留策略

| 数据类型 | 默认保留 | 建议保留 |
|----------|----------|----------|
| Metrics | 30 天 | 90 天 |
| Logs | 7 天 | 30 天 |
| Traces | 24 小时 | 7 天 |

### 清理数据

```bash
# VictoriaMetrics - 清理旧数据
# 在 vmagent 配置中设置 -retentionPeriod=90d

# Loki - 清理旧数据
# 在 loki 配置中设置 retention_period: 744h (31天)

# 手动清理日志
find ~/.openclaw/logs -name "*.log" -mtime +30 -delete
```

## 备份与恢复

### 备份配置

```bash
# 备份所有配置
tar -czf openclaw-obs-config-$(date +%Y%m%d).tar.gz \
  /opt/homebrew/etc/grafana \
  /opt/homebrew/etc/grafana-alloy \
  /opt/homebrew/etc/victoria-metrics \
  /opt/homebrew/etc/loki-config.yaml

# 备份 Dashboard
curl -u admin:admin http://localhost:3000/api/search?query=openclaw | \
  jq -r '.[].uid' | while read uid; do
    curl -u admin:admin "http://localhost:3000/api/dashboards/uid/$uid" > "dashboard-$uid.json"
  done
```

### 恢复配置

```bash
# 恢复配置文件
tar -xzf openclaw-obs-config-YYYYMMDD.tar.gz -C /

# 重启服务
brew services restart grafana
brew services restart grafana-alloy
brew services restart victoriametrics
brew services restart loki
```

## 扩容与缩容

### 增加存储

1. 修改 VictoriaMetrics 数据目录
2. 修改 Loki 数据目录
3. 迁移现有数据
4. 重启服务

### 增加 Agent

1. 修改 Alloy 配置
2. 增加采集目标
3. 重启 Alloy

## 升级指南

### 升级前准备

1. 备份所有配置
2. 记录当前版本
3. 阅读更新日志

### 升级步骤

```bash
# 升级 Grafana
brew upgrade grafana
brew services restart grafana

# 升级其他组件
brew upgrade victoriametrics loki grafana-alloy
brew services restart victoriametrics
brew services restart loki
brew services restart grafana-alloy
```

### 升级后验证

1. 检查服务状态
2. 检查 Dashboard 数据
3. 检查日志无错误
4. 功能测试

## 安全加固

### Grafana 安全

```bash
# 修改默认密码
# 在 Grafana UI 中: Configuration -> Users -> admin -> Change Password

# 禁用匿名访问
# 在 /opt/homebrew/etc/grafana/grafana.ini:
[auth.anonymous]
enabled = false
```

### 网络安全

- 所有服务仅监听 localhost
- 使用反向代理暴露到外部
- 启用 TLS 加密

## 监控自监控

### 检查可观测性栈健康

```bash
# 使用 Prometheus 查询
curl 'http://localhost:8428/api/v1/query?query=up' | jq '.data.result[] | select(.metric.job) | "\(.metric.job): \(.value[1])"'

# 检查数据摄入速率
curl 'http://localhost:8428/api/v1/query?query=rate(vm_rows_inserted_total[5m])' | jq .
```

## 相关文档

- [[09-Troubleshooting]] - 故障排查指南
- [[01-Overview-Dashboard]] - 概览 Dashboard
- [[02-Error-Analysis-Dashboard]] - 错误分析 Dashboard

---
#OpenClaw #Operations #DevOps
