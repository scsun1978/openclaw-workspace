# OpenClaw Observability 文档

> **版本**: v1.0  
> **更新日期**: 2026-02-22  
> **状态**: 生产就绪

## 概述

OpenClaw Observability 是一套完整的可观测性解决方案，用于监控、诊断和优化 OpenClaw AI Agent 系统的运行状态。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Observability                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Metrics   │    │    Logs     │    │   Traces    │     │
│  │ VictoriaMetrics│  │    Loki     │    │   Jaeger    │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                   │            │
│         └─────────────┬────┴───────────────────┘            │
│                       │                                     │
│                ┌──────┴──────┐                              │
│                │ Grafana     │                              │
│                │ Dashboards  │                              │
│                └─────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 组件

| 组件 | 端口 | 用途 |
|------|------|------|
| VictoriaMetrics | 8428 | 时序指标存储 |
| Loki | 3100 | 日志聚合 |
| Jaeger | 16686 | 分布式追踪 |
| Grafana | 3000 | 可视化 Dashboard |
| Alloy | 12345 | 数据采集器 |
| Node Exporter | 9100 | 系统指标 |

## Dashboard 列表

| Dashboard | UID | 用途 | 文档 |
|-----------|-----|------|------|
| Observability Overview | openclaw-overview | 系统整体健康状态 | [[01-Overview-Dashboard]] |
| Error Analysis | openclaw-errors | 错误监控与分析 | [[02-Error-Analysis-Dashboard]] |
| Token & Agent Monitor | openclaw-tokens | Token 使用与 Agent 活动 | [[03-Token-Agent-Dashboard]] |
| Tracing Dashboard | openclaw-tracing | 链路追踪分析 | [[04-Tracing-Dashboard]] |
| Health Dashboard | openclaw-health | 服务健康检查 | [[05-Health-Dashboard]] |
| Workload Dashboard | openclaw-workload | 工作负载监控 | [[06-Workload-Dashboard]] |
| Performance Dashboard | openclaw-performance | 性能基线 | [[07-Performance-Dashboard]] |

## 快速开始

1. 访问 Grafana: http://localhost:3000
2. 默认账号: `admin` / `admin`
3. 导航至 Dashboards → OpenClaw

## 相关文档

- [[01-Overview-Dashboard]] - 概览 Dashboard 详解
- [[02-Error-Analysis-Dashboard]] - 错误分析 Dashboard 详解
- [[03-Token-Agent-Dashboard]] - Token/Agent Dashboard 详解
- [[04-Tracing-Dashboard]] - 追踪 Dashboard 详解
- [[08-Operations-Guide]] - 运维手册
- [[09-Troubleshooting]] - 故障排查指南

---
#OpenClaw #Observability #Monitoring

## GitHub 仓库

项目代码已同步到 GitHub：

- **仓库地址**: https://github.com/scsun1978/openclaw-workspace
- **描述**: OpenClaw workspace - AI assistant configuration, skills, and observability

## 文件结构

```
openclaw-workspace/
├── .gitignore              # Git 忽略规则
├── AGENTS.md               # Agent 配置
├── HEARTBEAT.md            # 定时任务配置
├── MEMORY.md               # 长期记忆
├── SOUL.md                 # Agent 人格
├── USER.md                 # 用户信息
├── skills/                 # 技能目录
│   ├── github/             # GitHub 技能
│   └── mission-control/    # Mission Control 技能
└── memory/                 # 记忆目录
    └── YYYY-MM-DD.md       # 每日记忆
```

---
更新日期: 2026-02-22
