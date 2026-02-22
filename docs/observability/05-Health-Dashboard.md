# Health Dashboard

> **Dashboard UID**: `openclaw-health`  
> **访问地址**: http://localhost:3000/d/openclaw-health

## 用途

快速检查所有服务的**健康状态**，适合作为健康检查端点使用。

## 核心指标

| 指标 | 含义 | 健康值 |
|------|------|--------|
| Services Up | 在线服务数 | = 5 |
| Memory Free | 空闲内存 | > 20% |
| Disk Free | 磁盘空间 | > 20% |
| Error Rate | 错误率 | < 1% |

## 服务列表

| 服务 | 端口 | 检查方式 |
|------|------|----------|
| Grafana | 3000 | `/api/health` |
| VictoriaMetrics | 8428 | `/health` |
| Loki | 3100 | `/ready` |
| Alloy | 12345 | `/-/healthy` |
| Node Exporter | 9100 | `/metrics` |

## 使用场景

### 场景 1: 系统健康检查
- 定期检查所有服务是否在线
- 验证系统资源充足

### 场景 2: 告警前检查
- 收到告警后快速确认系统状态
- 定位问题范围

---
#OpenClaw #Dashboard #Health
