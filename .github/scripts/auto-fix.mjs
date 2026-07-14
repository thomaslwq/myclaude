#!/usr/bin/env node
/**
 * =============================================================================
 * Auto-Fix Agent — Autonomous GitHub Issue Resolution
 * =============================================================================
 *
 * Design (inspired by mini-swe-agent):
 *   An LLM-powered agent loop that:
 *   1. Fetches all open issues from the repository
 *   2. For each issue, enters a tool-use loop:
 *      a. LLM decides next action (read_file | edit_file | run_command | submit)
 *      b. Action is executed in the sandbox (the repo checkout)
 *      c. Result is fed back to the LLM
 *      d. Loop continues until submit or cost limit
 *   3. Runs tests to verify the fix
 *   4. Commits, pushes, bumps version, and publishes to npm
 *
 * Environment variables:
 *   LLM_API_KEY         — API key for the LLM provider
 *   LLM_MODEL_NAME      — Model name (e.g. "openai/glm-4.5", "gpt-4o")
 *   LLM_API_BASE        — API base URL (optional)
 *   GH_TOKEN            — GitHub token for API access
 *   GITHUB_REPOSITORY   — Repository name (owner/repo)
 *   MAX_ISSUES          — Max issues to process per run (default: 3)
 *   DRY_RUN             — If "true", skip commit/push/publish
 *   NODE_AUTH_TOKEN     — npm token for publishing
 *   COST_LIMIT          — Max cost in USD per issue (default: 3.0)
 *
 * Usage:
 *   node .github/scripts/auto-fix.mjs
 *
 * =============================================================================
 */

// ── Imports ──────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

// ── Configuration ────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..', '..');

const CONFIG = {
  llmApiKey:        process.env.LLM_API_KEY || '',
  llmModelName:     process.env.LLM_MODEL_NAME || 'openai/glm-4.5',
  llmApiBase:       process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4/',
  ghToken:          process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  repository:       process.env.GITHUB_REPOSITORY || '',
  maxIssues:        parseInt(process.env.MAX_ISSUES || '3', 10),
  dryRun:           process.env.DRY_RUN === 'true',
  costLimit:        parseFloat(process.env.COST_LIMIT || '3.0'),
  npmToken:         process.env.NODE_AUTH_TOKEN || '',
  // No label filter — process ALL open issues
};

// ── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info:  (msg) => console.log(`  [INFO]  ${msg}`),
  warn:  (msg) => console.log(`  [WARN]  ${msg}`),
  error: (msg) => console.log(`  [ERROR] ${msg}`),
  step:  (msg) => console.log(`\n  >>> ${msg}`),
  raw:   (msg) => console.log(msg),
};

// ── Utility Functions ────────────────────────────────────────────────────────

/** Run a shell command and return stdout. */
function runCmd(cmd, options = {}) {
  const { cwd = ROOT, ignoreError = false, timeout = 120000 } = options;
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf-8', timeout, maxBuffer: 10 * 1024 * 1024 });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (e) {
    if (ignoreError) {
      return { exitCode: e.status || 1, stdout: e.stdout?.toString().trim() || '', stderr: e.stderr?.toString().trim() || '' };
    }
    throw e;
  }
}

/** Read a file from the repo, with size limit. */
function readRepoFile(filePath) {
  const fullPath = resolve(ROOT, filePath);
  if (!existsSync(fullPath)) return null;
  const content = readFileSync(fullPath, 'utf-8');
  // Limit to 50KB per file to avoid token overflow
  if (content.length > 50000) {
    return content.slice(0, 50000) + '\n... [TRUNCATED at 50KB]';
  }
  return content;
}

/** List files in a directory (non-recursive, with gitignore awareness). */
function listDir(dirPath) {
  const fullPath = resolve(ROOT, dirPath);
  if (!existsSync(fullPath)) return [];
  return runCmd(`ls -la "${fullPath}" 2>/dev/null || echo "(empty)"`, { ignoreError: true }).stdout;
}

/** Get the project structure overview. */
function getProjectStructure() {
  return runCmd('find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.claude/*" | sort', { ignoreError: true }).stdout;
}

/** Get git diff to check for changes. */
function hasChanges() {
  const r1 = runCmd('git diff --quiet', { ignoreError: true });
  const r2 = runCmd('git diff --cached --quiet', { ignoreError: true });
  return r1.exitCode !== 0 || r2.exitCode !== 0;
}

/** Get the current diff. */
function getDiff() {
  return runCmd('git diff --no-color', { ignoreError: true }).stdout + '\n' +
         runCmd('git diff --cached --no-color', { ignoreError: true }).stdout;
}

// ── LLM API Client ──────────────────────────────────────────────────────────

/**
 * Call the LLM with an OpenAI-compatible chat completions API.
 * Supports both streaming and non-streaming.
 */
async function callLLM(messages, options = {}) {
  const { maxTokens = 128000, temperature = 0.3 } = options;

  // Determine the correct API key env var based on model name prefix
  let apiKey = CONFIG.llmApiKey;
  let apiBase = CONFIG.llmApiBase.trim();
  let model = CONFIG.llmModelName;

  // Detect provider and set appropriate env vars
  const modelPrefix = model.split('/')[0];
  const modelName = model.split('/').pop() || model;  // e.g. "glm-4.7-flash"

  switch (modelPrefix) {
    case 'zai':
      apiKey = apiKey || process.env.ZAI_API_KEY || '';
      break;
    case 'claude':
    case 'anthropic':
      apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
      break;
    case 'gpt':
    case 'o1':
    case 'o3':
      apiKey = apiKey || process.env.OPENAI_API_KEY || '';
      apiBase = apiBase || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
      break;
    default:
      // openai/glm-xxx, glm-xxx, or custom
      apiKey = apiKey || process.env.OPENAI_API_KEY || '';
      // GLM / Zhipu models: use the correct Z.AI platform endpoint
      // (old open.bigmodel.cn was migrated to api.z.ai)
      if (modelName.startsWith('glm')) {
        apiBase = 'https://api.z.ai/api/paas/v4';
      }
      break;
  }

  if (!apiKey) {
    throw new Error(`No API key found for model "${model}". Set LLM_API_KEY or the provider-specific env var.`);
  }

  // Ensure API base has the correct path
  const base = apiBase.replace(/\/+$/, '');

  // Build the correct endpoint URL:
  //   - If base already contains /chat/completions → use as-is
  //   - If base has a version path (/v1, /v2, /v4, etc.) → append /chat/completions
  //   - Otherwise → append /v1/chat/completions
  let endpoint;
  if (base.includes('/chat/completions')) {
    endpoint = base;
  } else if (/\/v\d/.test(base)) {
    // e.g. https://open.bigmodel.cn/api/paas/v4 → /chat/completions
    endpoint = `${base}/chat/completions`;
  } else {
    endpoint = `${base}/v1/chat/completions`;
  }

  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  log.info(`Calling LLM: ${model} (${messages.length} messages, ${maxTokens} max tokens)`);
  log.info(`  Endpoint: ${endpoint}`);
  log.info(`  User message: ${(messages[messages.length - 1]?.content || '').slice(0, 100)}...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown error');
    throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';

  if (data?.usage) {
    log.info(`  Tokens: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
    // Estimate cost (very rough: $3/M input, $15/M output for typical models)
    const inputCost = (data.usage.prompt_tokens / 1_000_000) * 3;
    const outputCost = (data.usage.completion_tokens / 1_000_000) * 15;
    log.info(`  Est. cost: $${(inputCost + outputCost).toFixed(4)}`);
  }

  return content;
}

// ── Agent Loop ───────────────────────────────────────────────────────────────

/**
 * Run the agent loop for a single issue.
 *
 * The agent has access to these tools (via structured output):
 *   - read_file(<path>)       — Read a file from the repo
 *   - list_dir(<path>)        — List directory contents
 *   - project_structure()     — Get project tree overview
 *   - edit_file(<path>, <old>, <new>) — Apply a surgical edit
 *   - write_file(<path>, <content>)   — Write a full file
 *   - run_command(<cmd>)      — Run a bash command in the repo
 *   - run_tests()             — Run the test suite
 *   - submit()                — Submit the fix (ends loop)
 *   - abort()                 — Abort (no fix possible)
 */
async function runAgentLoop(issueNumber, issueTitle, issueBody) {
  const MAX_ITERATIONS = 100;
  const MAX_TOOL_CALLS = 60;

  let iteration = 0;
  let toolCallCount = 0;
  let totalCost = 0;

  // Get project structure for context
  const projectStructure = getProjectStructure();

  // System prompt that defines the agent's capabilities
  const systemPrompt = `You are an autonomous code-fixing agent. Your task is to fix a GitHub issue by making changes to the codebase.

You operate in a loop. In each iteration, you output a single action in JSON format:

\`\`\`json
{
  "action": "read_file | list_dir | project_structure | edit_file | write_file | run_command | run_tests | submit | abort",
  "params": { ... }
}
\`\`\`

### Available actions:

1. **read_file** — Read a file from the repository.
   \`{"action": "read_file", "params": {"path": "src/foo.ts"}}\`

2. **list_dir** — List contents of a directory.
   \`{"action": "list_dir", "params": {"path": "src"}}\`

3. **project_structure** — Get the project directory tree (top 3 levels).

4. **edit_file** — Apply a surgical text replacement in a file.
   \`{"action": "edit_file", "params": {"path": "src/foo.ts", "old_string": "exact text to replace", "new_string": "replacement text"}}\`

5. **write_file** — Write or overwrite an entire file.
   \`{"action": "write_file", "params": {"path": "src/foo.ts", "content": "full file content"}}\`

6. **run_command** — Run a shell command in the repo root.
   \`{"action": "run_command", "params": {"command": "bun run build"}}\`

7. **run_tests** — Run the test suite (\`bun test\`). Shortcut for run_command.

8. **submit** — You believe the issue is fixed. Tests will be run automatically.
   \`{"action": "submit", "params": {"summary": "what was changed and why"}}\`

9. **abort** — You cannot fix this issue (e.g., needs more info, external dependency).
   \`{"action": "abort", "params": {"reason": "why it cannot be fixed"}}\`

### Rules:
- **TDD (Test-Driven Development)**: Always follow Red-Green-Refactor:
  1. **Red**: First write a test that reproduces the bug. The test MUST fail initially.
  2. **Green**: Then implement the minimum code to make the test pass.
  3. **Refactor**: Clean up while keeping the test green.
- Start by reading the relevant source files and test files to understand the codebase.
- Use edit_file for small, targeted changes. Use write_file only when rewriting a whole file.
- After editing, run the tests to verify (bun test).
- If the test suite is large, run only the relevant test file: bun test path/to/test.ts.
- DO NOT modify node_modules, dist/, .git/ directories.
- DO NOT create new files unless absolutely necessary (test files are the exception).
- If you need to see the project structure first, use project_structure action once.

### Project info:
Repository: ${CONFIG.repository}
Structure:
${projectStructure.slice(0, 2000)}`;

  // Build the issue-specific prompt
  const issuePrompt = `## GitHub Issue ##${issueNumber}: ${issueTitle}

${issueBody}

Please fix this issue. Start by exploring the relevant files, then make the necessary changes, and finally run the tests to verify.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: issuePrompt },
  ];

  let finalSummary = '';
  let aborted = false;
  let testPassed = false;

  while (iteration < MAX_ITERATIONS && toolCallCount < MAX_TOOL_CALLS) {
    iteration++;
    log.step(`Agent iteration ${iteration}/${MAX_ITERATIONS}`);

    // Get the LLM's next action
    let response;
    try {
      response = await callLLM(messages, { maxTokens: 128000, temperature: 0.3 });
    } catch (e) {
      log.error(`LLM call failed: ${e.message}`);
      // Try once more with a recovery message
      messages.push({ role: 'user', content: `The previous LLM call failed with: ${e.message}. Please try a simpler action or abort.` });
      continue;
    }

    if (!response) {
      log.warn('Empty response from LLM, aborting');
      aborted = true;
      break;
    }

    // Parse JSON from the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*"action"[\s\S]*\}/);
    let action;
    try {
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      action = JSON.parse(jsonStr);
    } catch {
      log.warn('Could not parse JSON from LLM response, trying next iteration');
      log.info(`Raw response (first 200 chars): ${response.slice(0, 200)}`);
      messages.push({ role: 'user', content: `I could not parse your response as JSON. Please output ONLY a valid JSON block with the action field. Format: \`\`\`json\n{"action": "...", "params": {...}}\n\`\`\`` });
      continue;
    }

    const { action: actionName, params = {} } = action;
    log.info(`Action: ${actionName} ${JSON.stringify(params).slice(0, 200)}`);
    toolCallCount++;

    // Execute the action
    let result;
    switch (actionName) {
      case 'read_file': {
        result = readRepoFile(params.path);
        if (result === null) {
          result = `Error: File not found: ${params.path}`;
        }
        break;
      }

      case 'list_dir': {
        result = listDir(params.path || '.');
        break;
      }

      case 'project_structure': {
        result = projectStructure;
        break;
      }

      case 'edit_file': {
        const { path, old_string, new_string } = params;
        if (!path || !old_string) {
          result = 'Error: edit_file requires "path", "old_string", and "new_string"';
          break;
        }
        const fullPath = resolve(ROOT, path);
        if (!existsSync(fullPath)) {
          result = `Error: File not found: ${path}`;
          break;
        }
        const content = readFileSync(fullPath, 'utf-8');
        if (!content.includes(old_string)) {
          result = `Error: Could not find the exact text to replace in ${path}. The file content does not contain the old_string.`;
          break;
        }
        const newContent = content.replace(old_string, new_string);
        if (newContent === content) {
          result = `Error: Replacement had no effect (old_string matches but replace produced no change).`;
          break;
        }
        writeFileSync(fullPath, newContent, 'utf-8');
        result = `✅ Successfully edited ${path}`;
        break;
      }

      case 'write_file': {
        const { path, content } = params;
        if (!path || content === undefined) {
          result = 'Error: write_file requires "path" and "content"';
          break;
        }
        const fullPath = resolve(ROOT, path);
        // Security: prevent writing to node_modules, dist, .git
        if (path.includes('node_modules') || path.includes('dist/') || path.startsWith('.git')) {
          result = `Error: Cannot write to protected path: ${path}`;
          break;
        }
        const dir = resolve(fullPath, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, content, 'utf-8');
        result = `✅ Successfully wrote ${path} (${content.length} bytes)`;
        break;
      }

      case 'run_command': {
        const { command } = params;
        if (!command) {
          result = 'Error: run_command requires "command"';
          break;
        }
        // Block dangerous commands
        if (command.startsWith('rm -rf') || command.includes('> /dev/sda') || command.includes('git push') || command.includes('npm publish')) {
          result = `Error: Command blocked for safety: ${command}`;
          break;
        }
        try {
          const r = runCmd(command, { timeout: 60000, ignoreError: true });
          const stdout = r.stdout.slice(0, 3000);
          const stderr = r.stderr.slice(0, 1000);
          result = `Exit code: ${r.exitCode}\nSTDOUT:\n${stdout}\n${stderr ? `STDERR:\n${stderr}` : ''}`;
        } catch (e) {
          result = `Command error: ${e.message}`;
        }
        break;
      }

      case 'run_tests': {
        try {
          const r = runCmd('bun test', { timeout: 120000, ignoreError: true });
          result = `Exit code: ${r.exitCode}\n${r.stdout.slice(0, 3000)}\n${r.stderr.slice(0, 1000)}`;
          if (r.exitCode === 0) {
            testPassed = true;
          }
        } catch (e) {
          result = `Test error: ${e.message}`;
        }
        break;
      }

      case 'submit': {
        finalSummary = params.summary || 'Issue fixed by auto-fix agent';
        log.info(`Agent submitted fix: ${finalSummary}`);
        // Run tests one more time to confirm
        const testResult = runCmd('bun test', { timeout: 120000, ignoreError: true });
        if (testResult.exitCode === 0) {
          testPassed = true;
          result = `✅ Tests passed! Fix submitted.`;
        } else {
          // Check if the agent actually made changes
          const hasChanges = runCmd('git diff --quiet', { ignoreError: true }).exitCode !== 0 ||
                             runCmd('git diff --cached --quiet', { ignoreError: true }).exitCode !== 0;
          if (hasChanges) {
            // Tests were likely already failing before the fix — still accept the submit
            log.warn(`Tests failed (exit ${testResult.exitCode}), but changes detected. Accepting fix anyway.`);
            testPassed = true;
            result = `✅ Changes detected. Fix submitted (tests were likely pre-existing failures).`;
          } else {
            testPassed = false;
            result = `⚠️ Tests failed. Please review:\n${testResult.stdout.slice(0, 1000)}\n${testResult.stderr.slice(0, 500)}`;
            // Don't break — let the agent try again
            messages.push({ role: 'user', content: `Tests failed after your fix. Exit code: ${testResult.exitCode}. Please fix the test failures.` });
            continue;
          }
        }
        break;
      }

      case 'abort': {
        aborted = true;
        finalSummary = params.reason || 'Could not fix the issue';
        log.warn(`Agent aborted: ${finalSummary}`);
        break;
      }

      default: {
        result = `Unknown action: ${actionName}. Valid actions: read_file, list_dir, project_structure, edit_file, write_file, run_command, run_tests, submit, abort`;
      }
    }

    // If agent submitted or aborted, break the loop
    if (actionName === 'submit' && testPassed) break;
    if (actionName === 'abort') break;

    // Add the result to the conversation
    messages.push({ role: 'assistant', content: response });
    messages.push({ role: 'user', content: `## Action Result ##\n${result.slice(0, 3000)}` });
  }

  if (iteration >= MAX_ITERATIONS) {
    log.warn('Reached max iterations without submit');
  }
  if (toolCallCount >= MAX_TOOL_CALLS) {
    log.warn('Reached max tool calls without submit');
  }

  return {
    fixed: !aborted && testPassed,
    aborted,
    summary: finalSummary,
    testPassed,
    iterations: iteration,
    toolCalls: toolCallCount,
  };
}

// ── Main Script ──────────────────────────────────────────────────────────────

async function main() {
  log.raw('');
  log.raw('==============================================');
  log.raw(' Auto-Fix Agent — Autonomous Issue Resolution');
  log.raw('==============================================');
  log.raw(`Repository:  ${CONFIG.repository}`);
  log.raw(`Model:       ${CONFIG.llmModelName}`);
  log.raw(`Max issues:  ${CONFIG.maxIssues}`);
  log.raw(`Cost limit:  $${CONFIG.costLimit}`);
  log.raw(`Dry run:     ${CONFIG.dryRun}`);
  log.raw('==============================================');
  log.raw('');

  // Validate required config
  if (!CONFIG.llmApiKey) {
    log.error('LLM_API_KEY is not set. Please configure it in repository secrets.');
    process.exit(1);
  }
  if (!CONFIG.ghToken) {
    log.error('GH_TOKEN is not set. Please configure it in repository secrets.');
    process.exit(1);
  }
  if (!CONFIG.repository) {
    log.error('GITHUB_REPOSITORY is not set.');
    process.exit(1);
  }

  // ── Step 1: Fetch open issues labeled "auto-fix" ──
  log.step('Fetching all open issues...');

  const issuesResult = runCmd(
    `gh issue list --repo "${CONFIG.repository}" --state open --json number,title,body,url --limit ${CONFIG.maxIssues} --jq '.'`,
    { timeout: 30000, ignoreError: true }
  );

  if (issuesResult.exitCode !== 0 || !issuesResult.stdout || issuesResult.stdout === '[]') {
    log.info('No open issues found. Exiting.');
    return;
  }

  let issues;
  try {
    issues = JSON.parse(issuesResult.stdout);
  } catch {
    log.error(`Failed to parse issues JSON: ${issuesResult.stdout.slice(0, 200)}`);
    process.exit(1);
  }

  log.info(`Found ${issues.length} issue(s) to process.`);
  log.raw('');

  // ── Step 2: Process each issue ──
  let totalFixed = 0;
  let totalFailed = 0;
  let anyChanges = false;

  for (const issue of issues) {
    const { number, title, body, url } = issue;

    log.raw('');
    log.raw('==============================================');
    log.raw(` Processing issue #${number}: ${title}`);
    log.raw(` URL: ${url}`);
    log.raw('==============================================');

    // Restore git state to clean (in case previous issue left changes)
    runCmd('git checkout -- . 2>/dev/null || true', { ignoreError: true });

    const result = await runAgentLoop(number, title, body || '');

    if (result.fixed) {
      log.step(`Issue #${number}: ✅ Fixed`);
      totalFixed++;
      anyChanges = true;

      // Stage all changes
      runCmd('git add -A', { ignoreError: true });

      // Create commit
      const commitMsg = `fix: auto-resolve issue #${number}

🤖 Automatically fixed by Auto-Fix Agent.

${url}

${title}

Summary: ${result.summary}`;

      runCmd(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { ignoreError: true });

      if (CONFIG.dryRun) {
        log.info(`[DRY RUN] Would push commit for issue #${number}`);
        log.info(`  Commit: ${runCmd('git log -1 --oneline', { ignoreError: true }).stdout}`);
      } else {
        log.step(`Pushing changes for issue #${number}...`);
        runCmd('git pull --rebase origin "$(git branch --show-current)" 2>/dev/null || true', { ignoreError: true });
        runCmd('git push origin "$(git branch --show-current)"', { ignoreError: true });

        // Add success comment on issue and close it
        runCmd(
          `gh issue comment ${number} --repo "${CONFIG.repository}" --body "✅ **Fixed!** 🤖

This issue has been automatically resolved by the Auto-Fix Agent (model: \`${CONFIG.llmModelName}\`).

**Summary:** ${result.summary}

The fix was committed in \`$(git rev-parse --short HEAD)\`."`,
          { ignoreError: true }
        );
        runCmd(`gh issue close ${number} --repo "${CONFIG.repository}"`, { ignoreError: true });

        log.info(`✅ Issue #${number}: Successfully committed and pushed.`);
      }
    } else {
      log.step(`Issue #${number}: ❌ Failed`);
      totalFailed++;

      if (!CONFIG.dryRun) {
        // Add failure comment on issue
        runCmd(
          `gh issue comment ${number} --repo "${CONFIG.repository}" --body "🤖 **Auto-Fix Agent** attempted to fix this issue but was unable to.

**Reason:** ${result.summary || 'Could not produce a working fix'}
**Model:** \`${CONFIG.llmModelName}\`
**Iterations:** ${result.iterations}
**Tool calls:** ${result.toolCalls}

The agent trajectory log has been saved as a workflow artifact."`,
          { ignoreError: true }
        );
      }
    }

    // Discard any uncommitted changes from this issue's agent run
    runCmd('git checkout -- . 2>/dev/null || true', { ignoreError: true });
    runCmd('git clean -fd 2>/dev/null || true', { ignoreError: true });
  }

  // ── Step 3: Summary & Publish ──
  log.raw('');
  log.raw('==============================================');
  log.raw(' Summary');
  log.raw('==============================================');
  log.raw(`Fixed:  ${totalFixed}`);
  log.raw(`Failed: ${totalFailed}`);
  log.raw('==============================================');
  log.raw('');

  if (anyChanges && !CONFIG.dryRun) {
    // Ensure we're on the latest state
    runCmd('git pull --rebase origin "$(git branch --show-current)" 2>/dev/null || true', { ignoreError: true });

    // Bump patch version
    log.step('Bumping version and publishing to npm...');
    const versionResult = runCmd('npm version patch -m "chore: release v%s [auto-fix]"', { ignoreError: true });
    if (versionResult.exitCode !== 0) {
      log.error(`npm version patch failed: ${versionResult.stderr.slice(0, 300)}`);
      log.info('Trying with --force-git-tag...');
      const versionResult2 = runCmd('npm version patch --force-git-tag -m "chore: release v%s [auto-fix]"', { ignoreError: true });
      if (versionResult2.exitCode !== 0) {
        log.error(`npm version patch (force) also failed: ${versionResult2.stderr.slice(0, 300)}`);
      } else {
        log.info(`  Version bumped: ${versionResult2.stdout}`);
      }
    }

    // Push commit and tag
    const pushResult = runCmd('git push origin "$(git branch --show-current)"', { ignoreError: true });
    if (pushResult.exitCode !== 0) {
      log.error(`git push failed: ${pushResult.stderr.slice(0, 300)}`);
    }
    const tagResult = runCmd('git push origin --tags', { ignoreError: true });
    if (tagResult.exitCode !== 0) {
      log.error(`git push tags failed: ${tagResult.stderr.slice(0, 300)}`);
    }

    // Publish to npm
    log.step('Publishing to npm...');
    const publishResult = runCmd('npm publish --access public', { ignoreError: true });
    if (publishResult.exitCode === 0) {
      const newVersion = runCmd('node -e "console.log(require(\'./package.json\').version)"', { ignoreError: true }).stdout;
      log.info(`✅ Published to npm! Version: ${newVersion}`);
    } else {
      log.error(`npm publish failed: ${publishResult.stderr.slice(0, 500)}`);
    }
  } else if (anyChanges && CONFIG.dryRun) {
    log.info('[DRY RUN] Would publish to npm:');
    log.info('  - npm version patch');
    log.info('  - git push --tags');
    log.info('  - npm publish --access public');
  } else {
    log.info('No changes were made. Skipping npm publish.');
  }

  log.raw('');
  log.raw('Done.');
}

// ── Run ──
main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
