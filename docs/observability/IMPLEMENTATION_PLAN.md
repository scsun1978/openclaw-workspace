# 实施计划

## Phase 1: MVP 实现（目标：能看见）

| 任务 | 目标服务器 | 预估 | 验收标准 | 状态 |
|------|------------|------|----------|------|
| T1.1 部署 VictoriaMetrics | 172.16.100.101 | 1h | curl localhost:8428 返回 UI | ⏳ |
| T1.2 部署 Loki | 172.16.100.101 | 1h | curl localhost:3100/ready | ⏳ |
| T1.3 部署 Grafana | 172.16.100.101 | 1h | 可访问 172.16.100.101:3000 | ⏳ |
| T1.4 部署 promtail | 172.16.100.235 | 1h | 日志可在 Loki 查询 | ⏳ |
| T1.5 部署 vmagent | 172.16.100.235 | 1h | 指标可远程写入 VM | ⏳ |
| T1.6 Health Dashboard | 172.16.100.101 | 1h | CPU/RAM/FD/进程状态 | ⏳ |
| T1.7 Workload Dashboard | 172.16.100.101 | 1h | 会话数/错误率 | ⏳ |

**里程碑 M0**: Gateway 探活可见 + 进程资源可见 + 日志可搜索

## Phase 2: 语义层（目标：能看懂）

| 任务 | 预估 | 验收标准 | 状态 |
|------|------|----------|------|
| T2.1 设计事件模型 schema | 2h | JSON schema + 示例 | ⏳ |
| T2.2 实现 log-parser.py | 4h | 输出 Prometheus metrics | ⏳ |
| T2.3 实现 process-monitor.py | 2h | 采集 CPU/内存/FD | ⏳ |
| T2.4 Debug Dashboard | 2h | sessionId 搜索面板 | ⏳ |
| T2.5 配置日志采样规则 | 1h | INFO 10% 采样 | ⏳ |

**里程碑 M1**: 语义指标可见 + 可按 sessionId 搜索

## Phase 3: 高级能力（目标：能定位根因）

| 任务 | 预估 | 验收标准 | 状态 |
|------|------|----------|------|
| T3.1 设计告警规则 | 2h | stuck_run/error_burst/... | ⏳ |
| T3.2 配置 vmalert | 2h | 告警可发送到企微 | ⏳ |
| T3.3 Analytics Dashboard | 2h | Token 趋势/工具排行 | ⏳ |
| T3.4 Linux strace 探针（可选） | 2h | syscall 级别定位 | ⏳ |

**里程碑 M2**: 异常检测 + 根因定位能力
