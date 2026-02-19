#!/bin/bash
# Task Coordinator - 快速检查脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/coordinator.py"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Task Coordinator - 检查所有项目${NC}"
echo "=================================="

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 未安装${NC}"
    exit 1
fi

# 执行检查
python3 "$PYTHON_SCRIPT" --check-all

echo ""
echo "=================================="
echo -e "${GREEN}✅ 检查完成${NC}"
