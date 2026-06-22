# @funnycode/myclaude

**myclaude** — 开源的 AI 编程助手，运行在你的终端中。  
本项目是 Claude Code 的 fork/rebrand，致力于提供独立、开放的 AI 编码体验。

![myclaude](https://raw.githubusercontent.com/thomaslwq/myclaude/main/docs/funnycode.png)

```bash
npx @funnycode/myclaude
```

---

## 功能特性

- **AI 对话** — 通过自然语言编写、重构、调试和解释代码
- **80+ 斜杠命令** — `/commit`、`/review`、`/plan`、`/doctor`、`/buddy`、`/achievements` 等
- **BUDDY 伙伴** — 终端电子宠物，与你一同成长。孵化、抚摸、培养。18 个物种、5 级稀有度、闪光变异
- **成就系统** — 边编码边解锁 20+ 成就：连续使用、里程牌、探索发现
- **文件操作** — 在 AI 指导下编辑、写入、创建和搜索文件
- **Git 集成** — 自动生成提交信息、管理分支、创建 PR
- **MCP 支持** — Model Context Protocol 可扩展工具集成
- **插件系统** — 安装和管理市场插件
- **Agent 模式** — 多步自主任务执行
- **技能系统** — 通过可复用技能扩展能力
- **终端 UI** — React Ink 界面，支持语法高亮、主题和 Vim 模式
- **多模型支持** — Anthropic、AWS Bedrock、Google Vertex AI、Microsoft Foundry

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
myclaude
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
| `/review` | 代码审查 |

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

### 伙伴 & 成就
| 命令 | 说明 |
|------|------|
| `/buddy` | 管理终端伙伴（孵化、抚摸、卡片、静音） |
| `/achievements` | 查看已解锁的成就和进度 |

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
| `/feedback` | 提交反馈（跳转 GitHub Issues） |
| `/thinkback` | 回溯思考过程 |

---

## BUDDY — 终端电子伙伴

myclaude 内置了一个终端电子宠物。每只宠物都根据你的用户 ID **确定性生成**——独一无二，不可作弊。

### 物种（共 18 种）

🦆 鸭子 &nbsp; 🪿 鹅 &nbsp; 🫧 果冻 &nbsp; 🐱 猫 &nbsp; 🐉 龙  
🐙 章鱼 &nbsp; 🦉 猫头鹰 &nbsp; 🐧 企鹅 &nbsp; 🐢 乌龟 &nbsp; 🐌 蜗牛  
👻 幽灵 &nbsp; 🦎 六角恐龙 &nbsp; 🦫 水豚 &nbsp; 🌵 仙人掌 &nbsp; 🤖 机器人  
🐰 兔子 &nbsp; 🍄 蘑菇 &nbsp; 🐈 胖猫

### 稀有度系统

| 稀有度 | 概率 | 星级 |
|--------|------|------|
| 普通 | 60% | ★ |
| 非凡 | 25% | ★★ |
| 稀有 | 10% | ★★★ |
| 史诗 | 4% | ★★★★ |
| 传说 | 1% | ★★★★★ |

还有独立于稀有度的 **1% 闪光概率**——闪光伙伴会闪闪发光 ✨

### 属性

每只伙伴有 5 项属性：`DEBUGGING`（调试）、`PATIENCE`（耐心）、`CHAOS`（混乱）、`WISDOM`（智慧）、`SNARK`（毒舌）——各有一项峰值属性和一项最低属性。

### 命令

| 命令 | 说明 |
|------|------|
| `/buddy hatch` | 孵化一只伙伴 |
| `/buddy pet` | 抚摸伙伴（爱心动画） |
| `/buddy card` | 查看伙伴卡片（属性、稀有度） |
| `/buddy mute` | 隐藏伙伴 |
| `/buddy unmute` | 重新显示伙伴 |

伙伴会对你对话的内容做出反应，通过气泡说话。每种物种都有不同的空闲动画和抚摸反应。

---

## 成就系统

边使用 myclaude 边解锁成就。用 `/achievements` 查看进度。

### 分类

| 类别 | 说明 |
|------|------|
| 🌟 入门 | 首次孵化、首次提交、首次审查、首次插件、首次技能 |
| 📊 使用 | 10/100 次提交、100/1000 条消息、切换模型、修改配置 |
| 🔥 连续 | 连续 3/7/30 天使用 |
| 🐾 Buddy | 孵化、抚摸 10/100 次、传说或闪光伙伴 |
| ⚡ 高级 | 添加 MCP 服务器 |

```bash
/achievements           # 查看已解锁成就摘要
/achievements list      # 查看全部成就及进度
```

---

## 已确认可用的功能

- ✅ 交互式 REPL（与 AI 对话）
- ✅ 打印模式（`-p` 参数）
- ✅ 模型切换（`/model`）
- ✅ 大多数斜杠命令
- ✅ MCP 服务器添加/删除/列表
- ✅ 插件安装
- ✅ Git 提交信息生成
- ✅ 文件编辑和创建
- ✅ 技能系统
- ✅ BUDDY 伙伴（孵化、抚摸、卡片、静音）
- ✅ 成就系统
- ✅ Vim 模式
- ✅ 配置管理
- ✅ Doctor 诊断
- ✅ 深色/浅色主题
- ✅ 按键绑定自定义
- ✅ API 密钥认证（兼容任何 Anthropic API 提供商）
- ✅ 多模型提供商（Bedrock / Vertex / Foundry）

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

## 开发

```bash
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev        # 开发模式
bun run build      # 构建到 dist/myclaude.mjs
bun run version    # 验证 CLI 启动
```

### 构建产物

构建脚本会将 `src/entrypoints/cli.tsx` 打包为单文件 `dist/myclaude.mjs`，并注入版本号等编译时常量。

### 目录结构

```
src/
├── achievements/  # 成就系统（类型定义、存储、检查器）
├── buddy/         # BUDDY 伙伴（精灵图、动画、类型）
├── commands/      # 斜杠命令实现
├── components/    # React Ink UI 组件
├── services/      # 后端服务（API、MCP、分析）
├── tools/         # 工具实现
├── utils/         # 共享工具函数
├── entrypoints/   # CLI 入口
└── main.tsx       # TUI 主入口
```

---

## 路线图

详见 [docs/ROADMAP.md](docs/ROADMAP.md)：

- **P0** — 激活隐藏功能（BUDDY、Auto Memory）✅
- **P1** — 成长系统（成就、技能推荐）
- **P2** — 互动体验（多交互模式、节日事件）
- **P3** — 扩展生态（插件市场、Skill Studio）
- **P4** — 智能进化（个性化微调、离线模式）

---

## 贡献

欢迎提交 PR 参与贡献！

### 指南

- Fork 仓库并创建功能分支
- 保持改动聚焦且最小化
- 提交前测试你的改动
- 向 `main` 分支发起 PR

---

## 相关链接

- **GitHub**: [https://github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **Gitee**: [https://gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)（镜像）
- **npm**: [https://www.npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)

---

## 许可证

MIT
