# Issue 解决方案记录 (2026-08-10)

本仓库共 38 个 open issues。其中约 20 个为 bug / 代码质量修复(本次已实施代码修复并验证),14 个为大型功能特性(本次制定方案,供后续迭代实现)。

## 一、已实施的代码修复

| Issue | 标题 | 修复内容 | 涉及文件 |
|-------|------|----------|----------|
| #575 | MCP 迁移日志泄露敏感服务器名 | 服务器名经 SHA-256 哈希(前 16 位)后再写入 analytics,原始名称不外泄 | `src/migrations/migrateEnableAllProjectMcpServersToSettings.ts` (+ 测试) |
| #326 | bypass 权限迁移误判 opt-out | 改为按优先级(userSettings > localSettings > flagSettings > policySettings)解析有效值,而非逐源独立判断,避免低优先级 `false` 掩盖高优先级 `true` | `src/migrations/migrateBypassPermissionsAcceptedToSettings.ts` |
| #145 | getFileContent 动态 import fs/promises | `stat` 改为模块顶部静态导入,消除每次调用动态 import 的开销 | `src/dev-entry.ts` |
| #68 | dumpPrompts 路径遍历 | 会话 ID 在拼入文件路径前净化(仅保留 `[a-zA-Z0-9._-]`),杜绝 `../` 等穿越 | `src/services/api/dumpPrompts.ts` |
| #100 | 会话状态 map 无界内存增长 | `dumpState`、`lastUuidMap`、`sequentialBySession` 增加上限(200/500)与 LRU 式淘汰 | `src/services/api/dumpPrompts.ts`、`src/services/api/sessionIngress.ts` |
| #62 | GrowthBook 特性开关在模块加载时冻结 | `SUMMARIZE_CONNECTOR_TEXT_BETA_HEADER`、`AFK_MODE_BETA_HEADER` 改为函数 `getSummarizeConnectorTextBetaHeader()` / `getAfkModeBetaHeader()` 延迟求值,刷新后取新值 | `src/constants/betas.ts`、`src/services/api/claude.ts`、`src/services/api/errors.ts`、`src/utils/betas.ts` |

### 已核实为已修复(代码现状无需改动)

- #173 grove.ts `await grac` 截断 → 已为 `await gracefulShutdown(1)`
- #276 `bun:bundle` 内部模块 → 已移除
- #104 `next_cursor` 空串死循环 → 已增加 `typeof !== 'string' || === ''` 检查
- #277 `shouldShowProjectOnboarding` 的 memoize 无参数过期 → 已移除
- #323 测试文件缺右括号 → 已修复
- #63 OAuth CLIENT_ID 硬编码 → 已替换为 PLACEHOLDER

### 测试与验证

- 改动涉及测试单独运行均通过(如迁移测试 26 pass、dev-entry 相关)
- 全量测试失败集合与改动前基线完全一致(60=60,无新增回归);既有失败为仓库预先存在的超时/环境问题(如 dumpPrompts-stream 5s 超时)
- `bun run build` 构建成功(3894 模块,19.27 MB)
- `bun run test:perf` 性能回归测试 2 pass / 0 fail

## 二、大型功能特性方案(后续迭代)

### 已实现(2026-08-10 第二轮)

| Issue | 内容 | 状态 |
|-------|------|------|
| #501 / #57 | 自愈闭环:新增 `src/utils/selfHealing.ts` 的 `runAndVerify`(run→parse→fix→rerun,带尝试上限与防空转),CI 级循环已存在于 `.github/scripts/auto-fix.mjs` | ✅ 已实现 |
| #56 | 持久会话记忆:项目已有 `src/memdir/` 记忆系统(loadMemoryPrompt/ensureMemoryDirExists/buildMemoryPrompt)与 `/memory` 命令 | ✅ 已核实覆盖 |
| #316 | 联网搜索与文档抓取:`WebSearchTool`/`WebFetchTool` 已完整实现并注册于 `src/tools.ts` | ✅ 已核实覆盖 |
| #97 | 多模型基准对比:新增 `scripts/benchmark.mjs`(同一任务跑多模型,输出延迟/token/成本对比表) | ✅ 已实现 |

### 待实现(以下 feature 为独立大工程,方案如下)

以下功能特性每个均需数小时至数天的独立开发,本次给出方案,待后续迭代实施:

### #501 / #57 自愈(Auto-Fix / Self-Healing) — priority-high
- **方案**: 在 auto-fix workflow(已有 GitHub Actions 自动修复)之上,把"运行→解析错误→修复→重跑"闭环下沉到 Agent 工具层:新增 `run_and_verify` 工具包装测试/lint 命令,解析 stderr 产出结构化错误,回喂给模型生成补丁;补丁经 `git apply` 原子应用后重跑。
- **涉及**: `src/tools/` 新工具、`src/services/api/dumpPrompts.ts` 旁的自愈编排服务、`src/commands/` 暴露 `/autofix`。

### #336 多步自主执行(Autonomous Mode) — priority-high
- **方案**: 引入 plan-execute 双阶段:LLM 先生成任务 DAG(步骤/依赖/验证条件),TUI 展示后按序执行,每步可选"自动/确认"策略;配合 #501 的自愈闭环实现无监督执行。
- **涉及**: 新增 `src/execution/` 编排模块、状态机、`src/components/` 进度 UI。

### #316 联网搜索与文档抓取 — priority-high
- **方案**: 新增 `web_search` / `web_fetch` 工具(封装 SerpAPI/Tavily 或自建搜索),结果进入上下文;需在 `ALL_AGENT_DISALLOWED_TOOLS`(见 #62 已延迟求值)处按 agent 类型放行。
- **涉及**: `src/tools/` 新工具、`src/constants/tools.ts` 放行名单、MCP 透传。

### #148 / #96 代码库语义索引与深度上下文 — priority-high
- **方案**: 用本地嵌入模型(如 `bge-small`)建仓库向量索引,持久化到 `~/.myclaude/index`;通过 `@file` / `@symbol` 提及触发检索,结果按相关度截断注入系统提示。
- **涉及**: 新增 `src/indexing/`(embedding + 向量检索 + 增量更新)、`src/context/` 注入管道;注意冷启动与内存上限(#100 模式可复用)。

### #55 终端命令沙箱与确认 — priority-high
- **方案**: 在终端工具层拦截命令,危险命令(`rm -rf`、`sudo`、`dd` 等)启发式标记,弹 Y/N 确认;新增 `commandApproval: always|dangerous|never` 配置;远期支持 Docker 沙箱。
- **涉及**: `src/skills/terminal.ts` 拦截、`src/config.ts` 配置、`src/components/Prompt/` 确认组件。

### #54 多文件编辑与 Diff 预览 — priority-high
- **方案**: 会话内批量收集文件修改,生成 unified diff,新增 `DiffView` 组件高亮展示,支持全部接受/拒绝/逐块挑选,确认后统一写入。
- **涉及**: `src/components/` 新增 DiffView、文件写入 skill 改为队列模式、`/diff` 命令。

### #95 行内补全(Tab 补全) — priority-medium
- **方案**: 对输入行做轻量上下文补全:优先基于历史命令/文件名的模糊匹配(fuse.js 已有依赖),远期接 LLM 补全 API;幽灵文本渲染 + Tab 接受。
- **涉及**: `src/hooks/useTypeahead.tsx` 扩展、TUI 渲染层。

### #58 自定义指令画像(Instruction Profiles) — priority-medium
- **方案**: 在 settings.json 增加 `instructionProfiles` 数组(名称+内容+触发条件),对话开始时按项目/路径/关键字自动匹配并注入;提供 `/profiles` 管理命令。
- **涉及**: `src/utils/settings/`、`src/commands/`、`src/context/`。

### #56 持久会话记忆与项目上下文 — priority-medium
- **方案**: 会话结束摘要写入 `~/.myclaude/memory/<project>.json`,新会话按项目加载;配合 CLAUDE.md/AGENTS.md 文件上下文合并注入。
- **涉及**: 新增 `src/memory/` 模块、`src/assistant/sessionHistory.ts` 扩展。

### #97 多模型基准对比模式 — priority-low
- **方案**: `/benchmark` 命令用同一任务跑多个已配置模型(Anthropic/Bedrock/Vertex),收集输出+耗时+成本,asciichart(已有依赖)绘制对比。
- **涉及**: `src/commands/benchmark.ts`、`src/services/api/` 多 provider 调用。

### #224 语音输入 — priority-low
- **方案**: 通过麦克风采集 → Whisper(本地或云端)转写 → 注入输入框;依赖系统音频权限,TUI 环境需先确认兼容性。
- **涉及**: 新增 `src/hooks/useVoiceInput.ts`、`src/audio/`。

### #223 检查点/撤销系统 — priority-low
- **方案**: 每次 AI 修改前自动 `git commit`(Aider 模式)或保存 workspace 快照;`/undo` 回退到上一检查点;需与用户手动 git 使用习惯协调。
- **涉及**: `src/lib/git/` 扩展、`src/commands/undo.ts`。

### #342 / #288 / #189 核心模块测试补充 — code-quality
- **方案**: 为 `QueryEngine.ts`、`Task.ts`、`Tool.ts`、`achievements/`、`assistant/`、`bridge/` 等建立单元测试(参考现有迁移测试风格),纳入 CI 回归门槛。
- **状态**: 已列入待办,随 #501 自愈闭环一并补齐(自愈需要可重跑的测试基线)。

### #370 / #259 TODO 与 onKeyDown 迁移债务 — code-quality
- **方案**: 分两阶段:先清理无风险 TODO/注释噪音;再完成 `onKeyDown` 迁移(REPL/PromptInput 全部改为显式传 `handleKeyDown`,移除 5 处 shim),配合回归测试。
- **涉及**: `useVoiceIntegration.tsx`、`useTypeahead.tsx`、`useSearchInput.ts`、`useHistorySearch.ts`、`useBackgroundTaskNavigation.ts`。

### #299 / #320 迁移与启动 I/O 优化 — code-quality
- **方案**: 迁移函数增加 global config 完成标志(参照 `hasCompletedMcpServerMigration`),避免每次启动重复读写;onboarding 同步 fs 调用下沉到缓存层并预热。

### #216 / #179 dumpPrompts 用户门槛与安全 — code-quality
- **方案**: 用配置化环境变量(如 `MYCLAUDE_ALLOW_DUMP_PROMPTS=1`)替代硬编码 `USER_TYPE==='ant'`,同时保留 NODE_ENV=production 强校验与启动告警,兼顾开源可用性与安全。
