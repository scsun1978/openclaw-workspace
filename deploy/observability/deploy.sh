#!/bin/bash
# OpenClaw Observability - Phase 1 部署脚本
# 执行方式: ./deploy.sh

set -e

PROJECT_DIR="/Users/shengchun.sun/Library/Mobile Documents/iCloud~md~obsidian/Documents/ctovault/03_PROJECTS/openclaw-observability"
SERVER="scsun@172.16.100.101"
OPENCLAW_NODE="scsun@172.16.100.235"

echo "=== Phase 1 MVP 部署 ==="

# Step 1: 部署服务器端组件
echo ""
echo ">>> Step 1: 部署 VictoriaMetrics + Loki + Grafana 到 $SERVER"

# 上传配置文件
echo "上传配置文件..."
scp -r "$PROJECT_DIR/config" "$SERVER:/home/scsun/openclaw-observability/"

# 启动服务
echo "启动 Docker Compose..."
ssh "$SERVER" << 'EOF'
cd /home/scsun/openclaw-observability/config
docker-compose up -d

# 等待服务启动
sleep 10

# 验证
echo "验证 VictoriaMetrics..."
curl -s http://localhost:8428/health || echo "VM 启动中..."

echo "验证 Loki..."
curl -s http://localhost:3100/ready || echo "Loki 启动中..."

echo "验证 Grafana..."
curl -s http://localhost:3000/api/health || echo "Grafana 启动中..."
EOF

echo "✅ 服务器端部署完成"

# Step 2: 部署 promtail 到 OpenClaw 节点
echo ""
echo ">>> Step 2: 部署 promtail 到 $OPENCLAW_NODE"

ssh "$OPENCLAW_NODE" << 'EOF'
mkdir -p /home/scsun/openclaw-observability

# 创建 promtail 配置
cat > /home/scsun/openclaw-observability/promtail.yml << 'PROMTAIL'
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://172.16.100.101:3100/loki/api/v1/push

scrape_configs:
  - job_name: openclaw
    static_configs:
      - targets:
          - localhost
        labels:
          job: openclaw
          host: openclaw-235
          __path__: /tmp/openclaw/openclaw-*.log
    pipeline_stages:
      - json:
          expressions:
            level: _meta.logLevelName
            timestamp: time
      - labels:
          level:
      - timestamp:
          source: timestamp
          format: RFC3339Nano
PROMTAIL

# 启动 promtail
docker run -d \
  --name promtail \
  -v /tmp/openclaw:/tmp/openclaw:ro \
  -v /home/scsun/openclaw-observability/promtail.yml:/etc/promtail/config.yml \
  -v /tmp:/tmp \
  grafana/promtail:latest \
  -config.file=/etc/promtail/config.yml

echo "✅ promtail 部署完成"
EOF

# Step 3: 部署 vmagent + node_exporter
echo ""
echo ">>> Step 3: 部署 vmagent + node_exporter 到 $OPENCLAW_NODE"

ssh "$OPENCLAW_NODE" << 'EOF'
# 创建 vmagent 配置
cat > /home/scsun/openclaw-observability/vmagent.yml << 'VMAGENT'
global:
  scrape_interval: 15s
  external_labels:
    node: openclaw-235

remoteWrite:
  - url: http://172.16.100.101:8428/api/v1/write

scrape_configs:
  - job_name: node_exporter
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: openclaw-235
VMAGENT

# 启动 node_exporter
docker run -d \
  --name node_exporter \
  --net="host" \
  --pid="host" \
  -v /:/host:ro,rslave \
  quay.io/prometheus/node-exporter:latest \
  --path.rootfs=/host

# 启动 vmagent
docker run -d \
  --name vmagent \
  -v /home/scsun/openclaw-observability/vmagent.yml:/etc/vmagent/config.yml \
  victoriametrics/vmagent:latest \
  -promscrape.config=/etc/vmagent/config.yml \
  -remoteWrite.url=http://172.16.100.101:8428/api/v1/write

echo "✅ vmagent + node_exporter 部署完成"
EOF

echo ""
echo "=== 部署完成 ==="
echo ""
echo "访问地址:"
echo "  Grafana: http://172.16.100.101:3000 (admin/admin123)"
echo "  VictoriaMetrics: http://172.16.100.101:8428"
echo ""
echo "下一步:"
echo "  1. 访问 Grafana 配置数据源"
echo "  2. 导入 Health Dashboard"
echo "  3. 验证日志和指标可查询"
