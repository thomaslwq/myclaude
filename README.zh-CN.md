# myclaude

开源的 AI 编码助手，运行在你的终端中——由 Claude 驱动。

```bash
npm install -g myclaude
myclaude
```

---

## 功能特性

- **自然语言编程** — 通过对话编写、重构、调试和解释代码
- **斜杠命令** — 80+ 内置命令：`/commit`、`/review`、`/test`、`/doc` 等
- **Git 集成** — 自动生成提交信息、创建 PR、管理分支
- **MCP 支持** — 通过 Model Context Protocol 扩展工具集成
- **插件系统** — 社区插件扩展
- **终端 UI** — 基于 React Ink 的界面，支持语法高亮

---

## 快速开始

### 1. 安装

```bash
npm install -g myclaude
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# 或使用 myclaude 别名：
export MYCLAUDE_API_KEY=sk-ant-...
```

### 3. 运行

```bash
myclaude
```

---

## 使用方法

```bash
myclaude                      # 启动交互式会话
myclaude -p "解释这个项目"     # 直接执行 prompt
myclaude --version            # 查看版本
myclaude --help               # 查看帮助
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `/commit` | 生成 Git 提交信息 |
| `/review` | 代码审查 |
| `/test` | 生成和运行测试 |
| `/doc` | 生成文档 |
| `/config` | 配置设置 |
| `/doctor` | 诊断安装 |
| `/model` | 切换 AI 模型 |
| `/clear` | 清除对话 |
| `/cost` | 查看使用统计 |

---

## 环境变量

支持 `MYCLAUDE_*` 和 `CLAUDE_CODE_*` 两种命名方式。  
两者同时设置时，`CLAUDE_CODE_*` 优先。

| 变量名 | 说明 |
|--------|------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | API 密钥（必填） |
| `ANTHROPIC_BASE_URL` / `MYCLAUDE_BASE_URL` | 自定义 API 地址 |
| `MYCLAUDE_MODEL` | 模型覆盖 |
| `MYCLAUDE_SIMPLE` | 简洁模式（无 TUI） |
| `MYCLAUDE_BRIEF` | 简报模式 |
| `MYCLAUDE_DISABLE_THINKING` | 禁用思考 |
| `MYCLAUDE_PROACTIVE` | 主动模式 |
| `MYCLAUDE_USE_BEDROCK` | 使用 AWS Bedrock |
| `MYCLAUDE_USE_VERTEX` | 使用 Google Vertex AI |
| `MYCLAUDE_USE_FOUNDRY` | 使用 Microsoft Foundry |
| `MYCLAUDE_DISABLE_AUTO_MEMORY` | 禁用自动记忆 |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` | 语法高亮主题 |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` | 空闲超时（默认 75 分钟） |
| `MYCLAUDE_EFFORT_LEVEL` | 努力级别 |

---

## 相关链接

- **源码仓库**: [https://gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)
- **问题反馈**: [https://gitee.com/thomaslwq/myclaude/issues](https://gitee.com/thomaslwq/myclaude/issues)

---

## 许可证

MIT
