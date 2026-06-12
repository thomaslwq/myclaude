# @funnycode/myclaude

开源的 AI 编码助手，运行在你的终端中——由 Claude 驱动。

```bash
npx @funnycode/myclaude
```

---

## 功能特性

- **AI 对话** — 通过自然语言编写、重构、调试和解释代码
- **80+ 斜杠命令** — `/commit`、`/review`、`/test`、`/doc`、`/config`、`/doctor` 等
- **文件操作** — 在 AI 指导下编辑、写入、创建和搜索文件
- **Git 集成** — 自动生成提交信息、管理分支、创建 PR
- **MCP 支持** — Model Context Protocol 可扩展工具集成
- **插件系统** — 安装和管理市场插件
- **Agent 模式** — 多步自主任务执行
- **技能系统** — 通过可复用技能扩展能力
- **终端 UI** — React Ink 界面，支持语法高亮、主题和 Vim 模式

---

## 快速开始

### 环境要求

- **Node.js >= 18**（也可以用 Bun）
- **Git**（部分功能需要）
- **Anthropic API 密钥** 或兼容的 AI 提供商

### 安装运行

```bash
npx @funnycode/myclaude
```

或全局安装：

```bash
npm install -g @funnycode/myclaude
npx @funnycode/myclaude
```

### 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# 或使用 myclaude 别名：
export MYCLAUDE_API_KEY=sk-ant-...
```

---

## 使用方法

```bash
npx @funnycode/myclaude                        # 启动交互式会话
npx @funnycode/myclaude -p "解释这个项目"       # 直接执行 prompt
npx @funnycode/myclaude --version              # 查看版本
npx @funnycode/myclaude --help                 # 查看帮助
```

---

## 斜杠命令

### 核心
| 命令 | 说明 |
|------|------|
| `/help` | 帮助 |
| `/clear` | 清除对话 |
| `/exit` | 退出 |
| `/resume` | 恢复之前的会话 |
| `/rewind` | 回退对话 |
| `/rename` | 重命名当前会话 |
| `/config` | 配置设置 |
| `/doctor` | 诊断和验证安装 |

### 代码和 Git
| 命令 | 说明 |
|------|------|
| `/commit` | 生成 Git 提交信息 |
| `/diff` | 查看 Git 差异 |
| `/branch` | 切换/创建分支 |
| `/plan` | 创建实施计划 |

### AI 和模型
| 命令 | 说明 |
|------|------|
| `/model` | 切换 AI 模型 |
| `/effort` | 设置努力级别 |
| `/fast` | 切换快速模式 |
| `/brief` | 切换简报模式 |
| `/output-style` | 设置输出风格 |

### 文件和上下文
| 命令 | 说明 |
|------|------|
| `/add-dir` | 添加目录到上下文 |
| `/context` | 显示当前上下文 |
| `/files` | 文件操作 |
| `/copy` | 复制内容 |

### MCP 和插件
| 命令 | 说明 |
|------|------|
| `/mcp` | 管理 MCP 服务器 |
| `/plugin` | 管理插件和市场 |
| `/reload-plugins` | 重新加载所有插件 |
| `/hooks` | 管理钩子 |

### 系统
| 命令 | 说明 |
|------|------|
| `/status` | 显示认证和会话状态 |
| `/stats` | 显示使用统计 |
| `/cost` | 显示费用信息 |
| `/color` | 设置颜色主题 |
| `/theme` | 设置 UI 主题 |
| `/keybindings` | 配置按键绑定 |
| `/vim` | 切换 Vim 模式 |
| `/terminal-setup` | 终端设置 |
| `/memory` | 管理 AI 记忆 |
| `/skills` | 管理技能 |
| `/sandbox` | 切换沙盒模式 |
| `/session` | 会话管理 |
| `/tag` | 标记当前会话 |
| `/export` | 导出会话 |
| `/upgrade` | 检查更新 |

---

## 已确认可用的功能

以下功能已经过测试并确认可用：

- ✅ 交互式 REPL（与 AI 对话）
- ✅ 打印模式（`-p` 参数）
- ✅ 模型切换（`/model`）
- ✅ 大部分斜杠命令
- ✅ MCP 服务器添加/删除/列表
- ✅ 插件安装
- ✅ Git 提交信息生成
- ✅ 文件编辑和创建
- ✅ 技能系统
- ✅ Vim 模式
- ✅ 配置管理
- ✅ Doctor 诊断
- ✅ 深色/浅色主题
- ✅ 按键绑定自定义
- ✅ API 密钥认证（兼容任何 Anthropic API 提供商）

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

## 贡献

欢迎提交 MR（Merge Request）参与贡献！

### 开发

```bash
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev
```

### 构建

```bash
bun run build    # 构建到 dist/myclaude.js
```

### 指南

- Fork 仓库并创建功能分支
- 保持改动聚焦且最小化
- 提交前测试你的改动
- 向 `main` 分支发起 MR

---

## 相关链接

- **GitHub**: [https://github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **npm**: [https://www.npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)
- **Gitee**: [https://gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)

---

## 许可证

MIT
