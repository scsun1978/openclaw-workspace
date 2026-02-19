## 2026-02-19: Stock-SimGame v1.5.0 正式结项
- **里程碑**: 完成从 MVP 到 v1.5.0 的全周期架构演进（W1-W14）。
- **成果**: 
  - 架构微服务化，性能提升 780 倍 (TPS 250k+, P99 < 5ms)。
  - 生产环境正式上线，具备蓝绿发布与自动化容灾能力。
  - 文档库归档完成。
- **状态**: 项目进入维护/持续监控阶段，v2.0 待启动。
- **结项文档**: `RELEASE-NOTES.md` (代号 Phoenix Rising), `PROJECT-SUMMARY.md`, `KNOWLEDGE-BASE-INVENTORY.md` (42份文档归档)。


- Bot-specific memory (this bot / this host context) should be recorded at:
  - https://www.notion.so/cloudservice/openclaw-bot-in-macbook-30570574a74f80ceb08afde345709dfb
- Shared memory (for coordination with other bots) should be recorded at:
  - https://www.notion.so/cloudservice/openclaw-shared-memory-30570574a74f8085b788f4976e386794

## Usage Rule

- If content is specific to this bot instance, machine, or local runtime behavior, store it in the **bot-specific** page.
- If content needs to be visible/usable by multiple bots, store it in the **shared memory** page.
