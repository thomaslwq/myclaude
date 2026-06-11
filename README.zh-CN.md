# myclaude

> 开源 AI 编码助手 — 基于 Claude Code，运行在你的终端

<p align="center">
  <img src="preview.png?raw=true" alt="myclaude CLI" width="700">
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用方法">使用方法</a> •
  <a href="#环境变量">环境变量</a> •
  <a href="#构建">构建</a> •
  <a href="#许可证">许可证</a>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

---

**myclaude** 是一款开源的 AI 编码助手，运行在终端中——由 Claude 驱动。

---

## 功能特性

- **AI 终端** — 用自然语言编程：编写、重构、调试、解释代码
- **斜杠命令** — 80+ 内置命令：`/commit`、`/review`、`/test`、`/doc` 等
- **文件操作** — 在 AI 指导下编辑、写入和创建文件
- **Git 集成** — 自动生成提交信息、创建 PR、管理分支
- **MCP 支持** — Model Context Protocol 可扩展工具集成
- **插件系统** — 社区插件和自定义工具扩展
- **Agent 模式** — 多步自主任务执行
- **终端 UI** — 基于 React Ink 的漂亮 TUI，支持语法高亮

---

## 快速开始

### 通过 npm 安装（即将发布）

```bash
npm install -g myclaude
myclaude
```

### 从源码运行

```bash
# 需要：Bun >= 1.3.5, Node.js >= 18
git clone https://gitee.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev
```

### 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# 或使用 myclaude 别名：
export MYCLAUDE_API_KEY=sk-ant-...
myclaude
```

---

## 使用方法

```bash
# 启动交互式 REPL
myclaude

# 非交互模式（直接执行 prompt）
myclaude -p "解释这个项目的架构"

# 查看版本
myclaude --version

# 查看帮助
myclaude --help
```

### 斜杠命令

| 命令 | 说明 |
|------|------|
| `/commit` | 生成 Git 提交信息 |
| `/review` | 代码审查 |
| `/test` | 生成和运行测试 |
| `/doc` | 生成文档 |
| `/config` | 配置 myclaude 设置 |
| `/doctor` | 诊断和验证安装 |
| `/plugin` | 管理插件和市场 |
| `/model` | 切换 AI 模型 |
| `/clear` | 清除对话历史 |
| `/cost` | 查看使用统计 |
| `/compact` | 压缩对话 |

---

## 环境变量

myclaude 同时支持 `MYCLAUDE_*` 和 `CLAUDE_CODE_*` 命名约定。
如果两者都设置了，`CLAUDE_CODE_*` 优先。

<details>
<summary>点击展开完整环境变量列表</summary>

| 变量名 | 说明 |
|--------|------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | Anthropic API 密钥 |
| `ANTHROPIC_BASE_URL` / `MYCLAUDE_BASE_URL` | 自定义 API 地址 |
| `MYCLAUDE_MODEL` / `CLAUDE_CODE_MODEL` | 模型覆盖 |
| `MYCLAUDE_MAX_OUTPUT_TOKENS` / `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 最大输出 token |
| `MYCLAUDE_DISABLE_THINKING` / `CLAUDE_CODE_DISABLE_THINKING` | 禁用思考 |
| `MYCLAUDE_SIMPLE` / `CLAUDE_CODE_SIMPLE` | 简洁模式（无 TUI） |
| `MYCLAUDE_BRIEF` / `CLAUDE_CODE_BRIEF` | 简报模式 |
| `MYCLAUDE_PROACTIVE` / `CLAUDE_CODE_PROACTIVE` | 主动模式 |
| `MYCLAUDE_USE_BEDROCK` / `CLAUDE_CODE_USE_BEDROCK` | 使用 AWS Bedrock |
| `MYCLAUDE_USE_VERTEX` / `CLAUDE_CODE_USE_VERTEX` | 使用 Google Vertex AI |
| `MYCLAUDE_USE_FOUNDRY` / `CLAUDE_CODE_USE_FOUNDRY` | 使用 Microsoft Foundry |
| `MYCLAUDE_DISABLE_AUTO_MEMORY` / `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | 禁用自动记忆 |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` / `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | 语法高亮主题 |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` / `CLAUDE_CODE_IDLE_THRESHOLD_MINUTES` | 空闲超时 |
| `MYCLAUDE_EFFORT_LEVEL` / `CLAUDE_CODE_EFFORT_LEVEL` | 努力级别 |

</details>

---

## 构建

```bash
bun run build    # 构建到 dist/myclaude.js
bun run dev      # 开发模式
bun run version  # 验证版本
```

构建会将 3796+ 个模块打包成一个 Bun 兼容的可执行文件。

---

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解指南。

---

## 许可证

MIT 许可证。详见 [LICENSE](LICENSE)。
