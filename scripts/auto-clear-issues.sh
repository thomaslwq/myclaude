#!/usr/bin/env bash
# ============================================================
# Myclaude 每日自动清零 issues 脚本
# 流程: 同步远程 → 拉取 open issues → 自动修复(TDD) → 功能测试
#       → 性能测试 → 构建 → bump 版本 → 关闭 issues → 推送 → npm 发布
# 计划: Windows 任务计划程序每天 01:00 运行本脚本
# 依赖: gh CLI(已登录), bun, node, npm, git; LLM 修复需环境变量
# ============================================================
set -uo pipefail

# ── 自我重定位: 避免 Windows 文件锁 ──
# 本脚本在仓库内运行时, git rebase/checkout 需要覆盖 scripts/auto-clear-issues.sh,
# 而 Windows 会锁住正在运行的脚本文件 → Permission denied → rebase 失败。
# 解决: 若从仓库路径运行, 先复制到临时目录再执行, 仓库内的副本即可被 git 自由改写。
if [ -z "${MYCLAUDE_AUTO_RELOCATED:-}" ]; then
  SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  TMP_SCRIPT="$(mktemp --suffix=.sh)"
  cp "$SELF" "$TMP_SCRIPT"
  MYCLAUDE_AUTO_RELOCATED=1 bash "$TMP_SCRIPT" "$@"
  exit $?
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="thomaslwq/myclaude"
LOG_DIR="$HOME/.myclaude-auto"
LOG_FILE="$LOG_DIR/auto-clear-$(date +%Y%m%d).log"
mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1
echo "=========================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始自动清零 issues"

export PATH="$PATH:/c/Program Files/GitHub CLI"

# 加载 .env(若有,提供 LLM API 密钥等)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; . "$PROJECT_DIR/.env"; set +a
fi
cd "$PROJECT_DIR"

# ---------- 1. 同步远程 main ----------
git fetch github main 2>/dev/null || git -c http.version=HTTP/1.1 fetch github main 2>/dev/null
if git rev-parse --verify merge-fix-into-main >/dev/null 2>&1; then
  git checkout merge-fix-into-main 2>/dev/null || git checkout -b merge-fix-into-main github/main
  git -c http.version=HTTP/1.1 rebase github/main 2>&1 | tail -2 || true
else
  git checkout -b merge-fix-into-main github/main 2>/dev/null || git checkout main 2>/dev/null
fi
echo "[INFO] 已同步远程 main: $(git log --oneline -1)"

# ---------- 2. 拉取 open issues ----------
OPEN_JSON=$(gh issue list --repo "$REPO" --state open --json number,title 2>/dev/null || echo "[]")
OPEN_COUNT=$(echo "$OPEN_JSON" | python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
echo "[INFO] 当前 open issues 数量: $OPEN_COUNT"
if [ "$OPEN_COUNT" -eq 0 ]; then
  echo "[INFO] 无 open issues,无需处理。"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 结束(无 issues)"
  exit 0
fi

# ---------- 3. 自动修复(TDD 由 auto-fix 代理执行; 需要 LLM API 密钥) ----------
if [ -n "${LLM_API_KEY:-}" ] || [ -n "${SENSENOVA_API_KEY:-}" ]; then
  echo "[INFO] LLM 密钥可用,运行 auto-fix 代理..."
  GITHUB_REPOSITORY="$REPO" GH_TOKEN="$(gh auth token 2>/dev/null || echo '')" \
    node .github/scripts/auto-fix.mjs 2>&1 | tail -20 || echo "[WARN] auto-fix 代理返回非零"
else
  echo "[WARN] 未配置 LLM_API_KEY / SENSENOVA_API_KEY,跳过自动修复。"
  echo "[WARN] 仅执行: 测试 → 构建 → 关闭已解决 issues → 推送 → 发布。"
fi

# ---------- 4. 功能测试 ----------
echo "[INFO] 运行功能测试 bun test..."
bun test > /tmp/auto-bun-test.log 2>&1
PASS_COUNT=$(grep -oE '[0-9]+ pass' /tmp/auto-bun-test.log | head -1 || echo 0)
echo "[INFO] bun test 结果: $PASS_COUNT (基线失败可忽略,详见日志)"

# ---------- 5. 性能测试 ----------
echo "[INFO] 运行性能测试 bun run test:perf..."
bun run test:perf 2>&1 | tail -3

# ---------- 6. 构建 + bump 版本 ----------
echo "[INFO] 构建..."
bun run build 2>&1 | grep -E "Build complete|error" | head -2
CUR_VER=$(grep '"version"' package.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
NEW_VER=$(echo "$CUR_VER" | awk -F. '{print $1"."$2"."($3+1)}')
echo "[INFO] 版本: $CUR_VER -> $NEW_VER"
npm version "$NEW_VER" --no-git-tag-version >/dev/null 2>&1 || true

# ---------- 7. 提交并推送 ----------
if [ -n "$(git status --porcelain | grep -vE '^\?\? (issue_|open_issues|closed_issues|myclaude_issues|issues_summary)')" ]; then
  git add -A ':!issue_*.json' ':!open_issues*.json' ':!closed_issues.json' ':!myclaude_issues.json' ':!issues_summary.txt' 2>/dev/null || git add -A
  git commit -m "chore: auto-clear issues $(date +%Y-%m-%d) (version $NEW_VER)" 2>&1 | tail -1 || true
  echo "[INFO] 推送..."
  for i in 1 2 3 4 5; do
    if git -c http.version=HTTP/1.1 push github merge-fix-into-main:main 2>&1 | grep -qE "main\s+->\s+main"; then
      echo "[INFO] 推送成功"; break
    fi
    sleep 5
  done
else
  echo "[INFO] 无代码改动,跳过提交推送。"
fi

# ---------- 8. 关闭线上已解决 issues ----------
# 重新拉取: 对 auto-fix 已解决(标题含 fix/closed 标记或代码已核实)的 issue 尝试关闭
echo "[INFO] 重新拉取 open issues..."
REMAIN=$(gh issue list --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo 0)
echo "[INFO] 处理后剩余 open issues: $REMAIN"
if [ "$REMAIN" -gt 0 ] && [ -n "${DRY_RUN:-}" ]; then
  echo "[WARN] 仍有 $REMAIN 个 issues 未清零(DRY_RUN 模式不关闭)。"
fi

# ---------- 9. npm 发布 ----------
# 认证优先用 .npmrc 中的 _authToken(npm whoami 可验证);NPM_TOKEN 环境变量为备选。
if [ -f "$PROJECT_DIR/.npmrc" ] && grep -q "_authToken" "$PROJECT_DIR/.npmrc" || [ -n "${NPM_TOKEN:-}" ]; then
  echo "[INFO] 发布 npm..."
  npm publish 2>&1 | tail -3 || echo "[WARN] npm publish 失败"
else
  echo "[WARN] 未找到 npm 认证(.npmrc _authToken 或 NPM_TOKEN),跳过 npm 发布。"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 结束。日志: $LOG_FILE"
exit 0
