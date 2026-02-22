# OpenClaw Observability - 项目启动指令

> 此文件供 main 会话读取，获取完整项目上下文

## 一句话启动

```
读取此文件，按 Phase 1 任务列表执行部署，完成后更新 tasks.json
```

---

## 项目背景

OpenClaw 可观测性系统，用于监控 OpenClaw 运行状态。

**架构**：
```
OpenClaw 节点 (172.16.100.235)    →    服务器 (172.16.100.101)
├── node_exporter                      ├── VictoriaMetrics:8428
├── promtail (日志)                    ├── Loki:3100
└── vmagent (指标)                     ├── Grafana:3000
                                       └── vmalert → 企微
```

---

## 部署环境

| 角色 | SSH | 容器 |
|------|-----|------|
| OpenClaw 节点 | scsun@172.16.100.235:22 | ✅ |
| 服务器 | scsun@172.16.100.101:22 | ✅ |

**告警渠道**：企微 webhook（见 tasks.json）

---

## Phase 1 任务列表

### T1.1-T1.3 服务器端（172.16.100.101）

```bash
# 1. 上传配置
scp -r config/ scsun@172.16.100.101:/home/scsun/openclaw-observability/

# 2. 启动服务
ssh scsun@172.16.100.101 "cd /home/scsun/openclaw-observability/config && docker-compose up -d"

# 3. 验证
curl http://172.16.100.101:8428/health     # VM
curl http://172.16.100.101:3100/ready      # Loki
curl http://172.16.100.101:3000/api/health # Grafana
```

### T1.4 promtail（172.16.100.235）

```bash
ssh scsun@172.16.100.235
docker run -d --name promtail \
  -v /tmp/openclaw:/tmp/openclaw:ro \
  -v /home/scsun/openclaw-observability/promtail.yml:/etc/promtail/config.yml \
  grafana/promtail:latest \
  -config.file=/etc/promtail/config.yml
```

### T1.5 vmagent + node_exporter（172.16.100.235）

```bash
ssh scsun@172.16.100.235
docker run -d --name node_exporter --net=host --pid=host -v /:/host:ro quay.io/prometheus/node-exporter:latest --path.rootfs=/host
docker run -d --name vmagent -v /home/scsun/openclaw-observability/vmagent.yml:/etc/vmagent/config.yml victoriametrics/vmagent:latest -promscrape.config=/etc/vmagent/config.yml -remoteWrite.url=http://172.16.100.101:8428/api/v1/write
```

---

## 完成标准

- [ ] VictoriaMetrics 可访问 (8428)
- [ ] Loki 可访问 (3100)
- [ ] Grafana 可访问 (3000)
- [ ] 日志可在 Grafana 中查询
- [ ] 指标可在 Grafana 中查看

---

## 任务跟踪

更新 `tasks.json` 中的 status 字段：
- `pending` → `in_progress` → `completed` / `failed`

---

## 关键文件

| 文件 | 用途 |
|------|------|
| `tasks.json` | 任务状态跟踪 |
| `config/docker-compose.yml` | 服务器端容器编排 |
| `config/loki.yml` | Loki 配置 |
| `config/promtail.yml` | 日志采集配置 |
| `config/vmagent.yml` | 指标采集配置 |
| `deploy.sh` | 一键部署脚本 |

---

## 遇到问题

1. 更新 tasks.json 标记 `failed`
2. 记录错误信息到 `history`
3. 通知用户
