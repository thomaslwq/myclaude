# 🎭 myclaude

> **你的终端 AI 编程搭档——更聪明地写代码，更快地交付。**

```bash
npx @funnycode/myclaude
```

[![npm](https://img.shields.io/npm/v/@funnycode/myclaude)](https://www.npmjs.com/package/@funnycode/myclaude)
[![License](https://img.shields.io/npm/l/@funnycode/myclaude)](LICENSE)

---

## ✨ myclaude 的独特之处

| | 功能 | 为什么你会爱上它 |
|---|------|----------------|
| 🐾 | **BUDDY 伙伴** | 终端电子宠物，随编码成长。孵化、喂食、玩耍。18 个物种、传说稀有度、闪光变异。 |
| 🏆 | **成就系统** | 20+ 成就，连续使用打卡、里程碑解锁——编码之旅的游戏化体验。 |
| 🎯 | **前端 TDD** | `/frontend-tdd` — 内置 Red-Green-Refactor 工作流，前端测试驱动开发。 |
| 🌊 | **Git Flow** | `/new-feature`、`/finish-release`、`/new-hotfix` — 完整的 Git Flow 斜杠命令。 |
| 🤖 | **ECC 内置** | 启动时自动注册 76+ 命令和 246+ 技能，零配置开箱即用。 |
| 🧠 | **AI 对话** | 编写、重构、调试、解释代码。多模型支持（Anthropic、Bedrock、Vertex、Foundry）。 |
| 🎨 | **精美 TUI** | React Ink 终端界面，支持主题切换、Vim 模式、语法高亮。 |
| 🔌 | **插件 & MCP** | 通过插件、MCP 服务器、自定义技能无限扩展。 |

---

## 🚀 10 秒快速开始

```bash
# 设置 API 密钥
export ANTHROPIC_API_KEY=sk-ant-...

# 立即运行（无需安装）
npx @funnycode/myclaude

# 或全局安装
npm install -g @funnycode/myclaude
myclaude
```

**环境要求：** Bun ≥ 1.3.5（或 Node.js ≥ 22.17）· Git

---

## 🎮 斜杠命令一览

### 📍 核心
| 命令 | 功能 |
|------|------|
| `/help` | 帮助 |
| `/config` | 配置设置 |
| `/doctor` | 诊断与验证 |
| `/model` | 切换 AI 模型 |
| `/effort` | 设置努力级别 |

### 🧪 测试与质量
| 命令 | 功能 |
|------|------|
| **`/frontend-tdd <描述>`** | **前端 TDD 红绿重构循环** |
| `/review` | 代码审查 |
| `/plan` | 创建实施计划 |

### 🌊 Git Flow
| 命令 | 功能 |
|------|------|
| `/new-feature <name> [来源]` | 从 `main` 创建功能分支 |
| `/finish-feature [目标]` | 合并功能到 `main` |
| `/new-release <version> [来源]` | 创建发布分支 |
| `/finish-release` | 合并发布到 `main` & `develop` |
| `/new-hotfix <name> [来源]` | 创建热修复分支 |
| `/finish-hotfix` | 合并热修复到 `main` & `develop` |
| `/commit` | 生成 Git 提交信息 |

### 🐾 伙伴 & 成就
| 命令 | 功能 |
|------|------|
| `/buddy hatch` | 孵化伙伴 |
| `/buddy pet` | 抚摸伙伴（+5 XP ❤️） |
| `/buddy feed` | 喂食伙伴（+15 XP） |
| `/buddy play` | 与伙伴玩耍（+20 XP） |
| `/buddy card` | 查看属性与里程碑 |
| `/achievements` | 查看成就进度 |

### 🔌 集成
| 命令 | 功能 |
|------|------|
| `/mcp` | 管理 MCP 服务器 |
| `/plugin` | 安装管理插件 |
| `/hooks` | 管理钩子 |
| `/skills` | 查看可用技能 |

### ⚙️ 系统
| 命令 | 功能 |
|------|------|
| `/status` | 会话与认证状态 |
| `/vim` | 切换 Vim 模式 |
| `/theme` | 切换 UI 主题 |
| `/keybindings` | 自定义快捷键 |
| `/memory` | 管理 AI 记忆 |
| `/feedback` | 提交反馈 |

---

## 🐾 BUDDY — 你的终端宠物

myclaude 有一个生活在终端里的 **电子宠物**。它根据你的用户 ID **确定性生成**——每一只都独一无二。

### 18 个物种

🦆 鸭子 · 🪿 鹅 · 🫧 果冻 · 🐱 猫 · 🐉 龙 · 🐙 章鱼 · 🦉 猫头鹰
🐧 企鹅 · 🐢 乌龟 · 🐌 蜗牛 · 👻 幽灵 · 🦎 六角恐龙 · 🦫 水豚
🌵 仙人掌 · 🤖 机器人 · 🐰 兔子 · 🍄 蘑菇 · 🐈 胖猫

### 稀有度与属性

| 稀有度 | 概率 | 星级 |
|--------|------|------|
| 普通 | 60% | ★ |
| 非凡 | 25% | ★★ |
| 稀有 | 10% | ★★★ |
| 史诗 | 4% | ★★★★ |
| 传说 | **1%** | ★★★★★ |
| ✨ 闪光 | **1%**（独立概率）| 闪闪发光！ |

每只伙伴有 5 项属性：`DEBUGGING`（调试）、`PATIENCE`（耐心）、`CHAOS`（混乱）、`WISDOM`（智慧）、`SNARK`（毒舌）。通过互动获得经验值，最高 50 级，**进化**为全新形态。

---

## 🎯 前端 TDD

```bash
/frontend-tdd 实现一个带邮箱验证的用户登录表单
```

这个命令引导 AI 遵循 **红-绿-重构** 循环进行前端测试驱动开发：

🔴 **红** → 先写一个会失败的测试  
🟢 **绿** → 编写最少代码让测试通过  
🔵 **重构** → 优化代码，保持测试绿色

内置前端测试最佳实践：Testing Library 行为查询、`user-event` 替代 `fireEvent`、异步 `waitFor`/`findBy*`、MSW API 模拟、无障碍优先选择器。

---

## 🌊 Git Flow 工作流

```bash
/new-feature user-auth                  # feature/user-auth 从 main 创建
/new-feature api-rate-limit develop      # feature/api-rate-limit 从 develop 创建
/finish-feature                          # 合并到 main
/finish-feature develop                  # 合并到 develop
/new-release 1.2.0                       # release/1.2.0 从 main 创建
/new-hotfix security-patch               # hotfix/security-patch 从 main 创建
/finish-hotfix                           # 合并到 main & develop
```

所有命令默认以 `main` 为基准，支持可选的 `[来源]` 或 `[目标]` 参数。

---

## 🔌 内置集成

### CodeGraph — 语义代码智能
自动检测 `codegraph` CLI 并注册为内置插件，提供精确的代码上下文。

```bash
npm i -g @colbymchenry/codegraph
cd your-project
codegraph init
/plugin enable codegraph
```

### ECC — 跨平台代理操作系统
**76+ 命令和 246+ 技能**在启动时自动加载——无需安装、无需配置。直接敲 `/` 即可用。

---

## ⚙️ 环境变量

支持 `MYCLAUDE_*` 或 `CLAUDE_CODE_*`（后者优先级更高）。

| 关键变量 | 说明 |
|---------|------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | API 密钥（必填） |
| `ANTHROPIC_BASE_URL` | 自定义 API 地址 |
| `MYCLAUDE_MODEL` | 覆盖模型 |
| `MYCLAUDE_SIMPLE` | 简洁模式（无 TUI） |
| `MYCLAUDE_DISABLE_THINKING` | 禁用扩展思考 |
| `MYCLAUDE_USE_BEDROCK` | AWS Bedrock 提供商 |
| `MYCLAUDE_USE_VERTEX` | Google Vertex AI 提供商 |
| `MYCLAUDE_USE_FOUNDRY` | Microsoft Foundry 提供商 |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` | 语法高亮主题 |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` | 空闲超时（默认 75 分钟） |
| `MYCLAUDE_EFFORT_LEVEL` | 努力级别 |

---

## 🛠 开发

```bash
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev          # 开发模式
bun run build        # 构建到 dist/myclaude.mjs
bun run version      # 验证 CLI 启动
```

### 目录结构

```
src/
├── achievements/    # 成就系统
├── buddy/           # BUDDY 伙伴（精灵图、进化）
├── commands/        # 所有斜杠命令
├── components/      # React Ink UI
├── events/          # 日历与节日彩蛋
├── services/        # API、MCP、分析
├── tools/           # 工具实现
├── utils/           # 共享工具函数
├── entrypoints/     # CLI 入口
└── main.tsx         # TUI 主入口
```

---

## 🤝 贡献

欢迎 PR！Fork → 创建分支 → 保持聚焦 → 测试 → 提交 PR。

---

## 📎 相关链接

- **GitHub**: [github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **Gitee**: [gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)
- **npm**: [npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)

---

## 📄 许可证

MIT
