#!/usr/bin/env node
/**
 * =============================================================================
 * Issue Scanner — Autonomous Codebase & Competitor Issue Generator
 * =============================================================================
 *
 * This script runs on a cron schedule and does two things:
 *
 * 1. REPOSITORY SCAN:
 *    - Analyzes the project structure & key source files
 *    - Checks for outdated dependencies
 *    - Scans for TODO/FIXME/HACK/SECURITY comments
 *    - Uses an LLM to identify potential code quality issues, bugs, and
 *      areas for improvement
 *    - Creates GitHub issues for significant findings
 *
 * 2. COMPETITOR / MARKET RESEARCH:
 *    - Queries the LLM for the latest features and optimizations in similar
 *      code agent tools (Claude Code, Cursor, Copilot, Aider, etc.)
 *    - Identifies feature gaps and opportunities
 *    - Creates GitHub issues for actionable improvements
 *
 * Environment variables:
 *   LLM_API_KEY         — API key for the LLM provider
 *   LLM_MODEL_NAME      — Model name (e.g. "openai/gpt-4o", "glm-4.5")
 *   LLM_API_BASE        — API base URL (optional)
 *   GH_TOKEN            — GitHub token for API access
 *   GITHUB_REPOSITORY   — Repository name (owner/repo)
 *   DRY_RUN             — If "true", skip creating issues (just log)
 *   SCAN_DEPTH          — Max subdirectories deep to scan (default: 4)
 *   MAX_FILES           — Max files to analyze per scan (default: 30)
 *   MAX_ISSUES          — Max issues to create per run (default: 5)
 *
 * Usage:
 *   node .github/scripts/issue-scanner.mjs
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
  llmApiKey:    process.env.LLM_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
  llmModelName: process.env.LLM_MODEL_NAME || process.env.ANTHROPIC_MODEL || 'openai/gpt-4o',
  llmApiBase:   process.env.LLM_API_BASE || process.env.ANTHROPIC_BASE_URL || '',

  // SenseTime (商汤日日新) — primary model
  sensenovaApiKey: process.env.SENSENOVA_API_KEY || '',
  sensenovaModel:  'deepseek-v4-flash',
  sensenovaApiBase: 'https://token.sensenova.cn/v1',

  ghToken:      process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  ghToken:      process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  repository:   process.env.GITHUB_REPOSITORY || '',
  dryRun:       process.env.DRY_RUN === 'true',
  scanDepth:    parseInt(process.env.SCAN_DEPTH || '4', 10),
  maxFiles:     parseInt(process.env.MAX_FILES || '30', 10),
  maxIssues:    parseInt(process.env.MAX_ISSUES || '5', 10),
};

// ── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info:  (msg) => console.log(`  [INFO]  ${msg}`),
  warn:  (msg) => console.log(`  [WARN]  ${msg}`),
  error: (msg) => console.log(`  [ERROR] ${msg}`),
  step:  (msg) => console.log(`\n  >>> ${msg}`),
  raw:   (msg) => console.log(msg),
  title: (msg) => console.log(`\n${'='.repeat(70)}\n  ${msg}\n${'='.repeat(70)}`),
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
  if (content.length > 30000) {
    return content.slice(0, 30000) + '\n... [TRUNCATED at 30KB]';
  }
  return content;
}

/** Get the project structure overview. */
function getProjectStructure() {
  return runCmd(
    `find . -maxdepth ${CONFIG.scanDepth} -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.claude/*" -not -path "*/.atomcode/*" -not -path "*/seed/*" | sort`,
    { ignoreError: true }
  ).stdout;
}

/** Get a list of the most important source files for analysis. */
function getKeySourceFiles() {
  const result = runCmd(
    `find src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" 2>/dev/null | head -${CONFIG.maxFiles}`,
    { ignoreError: true }
  );
  return result.stdout ? result.stdout.split('\n').filter(Boolean) : [];
}

/** Check for outdated dependencies. */
function checkOutdatedDeps() {
  log.step('Checking for outdated dependencies...');

  // Check npm outdated
  const outdated = runCmd('npm outdated --json 2>/dev/null || echo "{}"', { ignoreError: true, timeout: 60000 });
  try {
    const data = JSON.parse(outdated.stdout);
    const entries = Object.entries(data);
    if (entries.length === 0) {
      log.info('All dependencies are up to date.');
      return null;
    }
    log.warn(`Found ${entries.length} outdated dependencies.`);
    return entries.map(([name, info]) => ({
      name,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
    }));
  } catch {
    log.info('Could not parse outdated check (likely all up-to-date).');
    return null;
  }
}

/** Check for TODO/FIXME/HACK/SECURITY comments in the codebase. */
function scanForComments() {
  log.step('Scanning for TODO/FIXME/HACK/SECURITY comments...');

  const patterns = {
    TODO: 'TODO|FIXME|HACK|XXX',
    SECURITY: 'SECURITY|CVE-|vulnerability|insecure|sanitize|escape',
    PERF: 'PERF|performance|slow|bottleneck|O(n',
    WORKAROUND: 'WORKAROUND|workaround|hack|temporary|quickfix',
  };

  const results = {};
  for (const [category, pattern] of Object.entries(patterns)) {
    const grepResult = runCmd(
        `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" -E "${pattern}" src/ 2>/dev/null | head -50`,
        { ignoreError: true, timeout: 30000 }
      );
    if (grepResult.stdout) {
      results[category] = grepResult.stdout.split('\n').filter(Boolean);
    }
  }

  const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  log.info(`Found ${total} annotated comments across ${Object.keys(results).length} categories.`);

  return results;
}

/** Check for untested modules. */
function checkTestCoverage() {
  log.step('Checking test coverage gaps...');

  // Find source files without corresponding test files
  const srcFiles = runCmd(
    `find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort`,
    { ignoreError: true }
  ).stdout.split('\n').filter(Boolean);

  const untested = [];
  for (const file of srcFiles) {
    // Skip index files, type files, and entry points
    if (file.endsWith('/index.ts') || file.endsWith('/types.ts') || file.endsWith('.test.ts') || file.endsWith('.spec.ts')) continue;

    const baseName = file.replace(/\.tsx?$/, '');
    const testFile1 = `${baseName}.test.ts`;
    const testFile2 = `${baseName}.test.tsx`;
    const testFile3 = `${baseName}.spec.ts`;
    const testDir = `${baseName}/__tests__/`;

    if (!existsSync(resolve(ROOT, testFile1)) &&
        !existsSync(resolve(ROOT, testFile2)) &&
        !existsSync(resolve(ROOT, testFile3)) &&
        !existsSync(resolve(ROOT, testDir))) {
      untested.push(file);
    }
  }

  if (untested.length > 0) {
    log.warn(`Found ${untested.length} source files without corresponding test files.`);
    // Only report top 15
    return untested.slice(0, 15);
  }
  log.info('All source files have corresponding test files.');
  return [];
}

/**
 * Try to extract and parse a JSON array from an LLM response.
 * Handles markdown code fences, truncated JSON, and trailing commas.
 */
function extractJSONArray(response) {
  if (!response) return null;

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = response.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();

  // Find the first `[` and try to match a complete JSON array
  const startIdx = cleaned.indexOf('[');
  if (startIdx === -1) return null;

  cleaned = cleaned.slice(startIdx);

  // Try to parse as-is first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Truncated JSON — try to fix it
  }

  // Fix truncated JSON: try progressively shorter strings
  // Find the last valid position by trying to parse suffixes
  for (let end = cleaned.length; end > 0; end--) {
    // Skip if we're in the middle of a string value (no closing quote)
    const segment = cleaned.slice(0, end);
    try {
      return JSON.parse(segment);
    } catch {
      // Continue trying shorter segments
    }
  }

  // Last resort: try to close all open brackets/quotes
  let fixed = cleaned;
  // Close unclosed strings
  let inStr = false;
  let esc = false;
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
  }
  if (inStr) fixed += '"';

  let openBrackets = (fixed.match(/\[/g) || []).length;
  let closeBrackets = (fixed.match(/\]/g) || []).length;
  while (closeBrackets < openBrackets) { fixed += ']'; closeBrackets++; }
  // Remove trailing comma before final bracket
  fixed = fixed.replace(/,\s*\]\s*$/, ']');
  // Remove trailing commas in objects
  fixed = fixed.replace(/,\s*}/g, '}');

  try {
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}
function getRecentActivity() {
  const logOutput = runCmd(
    'git log --oneline --since="7 days ago" 2>/dev/null | head -30',
    { ignoreError: true }
  );
  return logOutput.stdout || '(no recent activity)';
}

// ── LLM API Client ──────────────────────────────────────────────────────────

/**
 * Call the LLM with an OpenAI-compatible chat completions API.
 * Tries SenseTime (商汤日日新) first, falls back to the configured LLM on failure.
 */
async function callLLM(messages, options = {}) {
  const { maxTokens = 64000, temperature = 0.3 } = options;

  // ── Primary: SenseTime DeepSeek-v4-flash ──
  if (CONFIG.sensenovaApiKey) {
    try {
      return await _callSingleLLM({
        apiKey: CONFIG.sensenovaApiKey,
        apiBase: CONFIG.sensenovaApiBase,
        model: CONFIG.sensenovaModel,
        messages,
        maxTokens,
        temperature,
        timeout: 120000,
        label: 'SenseTime DeepSeek-v4-flash',
      });
    } catch (err) {
      log.warn(`SenseTime model failed: ${err.message}`);
      log.warn('  Falling back to secondary LLM...');
    }
  }

  // ── Fallback: configured LLM ──
  return await _callSingleLLM({
    apiKey: CONFIG.llmApiKey,
    apiBase: CONFIG.llmApiBase,
    model: CONFIG.llmModelName,
    messages,
    maxTokens,
    temperature,
    timeout: 120000,
    label: CONFIG.llmModelName,
  });
}

  /**

 * Internal: call a single OpenAI-compatible chat completions API.
 */
async function _callSingleLLM({ apiKey, apiBase, model, messages, maxTokens, temperature, timeout, label }) {
  apiKey = apiKey || '';
  apiBase = (apiBase || '').trim();
  model = model || '';
  if (!apiKey) {
    throw new Error(`No API key found for "${label}".`);
  }
  const modelPrefix = model.split('/')[0];
  const modelName = model.split('/').pop() || model;
  let resolvedBase = apiBase;
  if (!resolvedBase) {
    if (modelPrefix === 'claude' || modelPrefix === 'anthropic') {
      resolvedBase = 'https://api.anthropic.com/v1';
    } else if (modelPrefix === 'gpt' || modelPrefix === 'o1' || modelPrefix === 'o3') {
      resolvedBase = 'https://api.openai.com/v1';
    } else if (modelName.startsWith('glm')) {
      resolvedBase = 'https://api.z.ai/api/paas/v4';
    } else {
      resolvedBase = 'https://api.openai.com/v1';
    }
  }
  const base = resolvedBase.replace(/\/+$/, '');
  let endpoint;
  if (base.includes('/chat/completions')) {
    endpoint = base;
  } else if (/\/v\d/.test(base)) {
    endpoint = `${base}/chat/completions`;
  } else {
    endpoint = `${base}/v1/chat/completions`;
  }
  const payload = { model: modelName, messages, max_tokens: maxTokens, temperature };
  log.info(`Calling LLM: ${label} (${messages.length} messages, ${maxTokens} max tokens)`);
  log.info(`  Endpoint: ${endpoint}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout || 120000),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown error');
    throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
  }
  const data = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message || {};
  let content = message.content || message.reasoning_content || '';
  if (data?.usage) {
    log.info(`  Tokens: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
  }
  if (!content) {
    log.warn(`  LLM returned empty content. finish_reason: ${choice?.finish_reason}`);
  }
  return content;
}

const GH_API_BASE = 'https://api.github.com';

async function ghRequest(method, path, body = null) {
  const url = `${GH_API_BASE}${path}`;
  const headers = {
    'Authorization': `Bearer ${CONFIG.ghToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'issue-scanner/1.0',
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`GitHub API error ${response.status} on ${method} ${path}: ${errText.slice(0, 300)}`);
  }
  return response.json();
}

/** Check if a similar issue already exists. */
async function findExistingIssue(title) {
  try {
    const issues = await ghRequest('GET', `/repos/${CONFIG.repository}/issues?state=open&per_page=50`);
    const keywords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const issue of issues) {
      const issueText = `${issue.title} ${issue.body || ''}`.toLowerCase();
      const matchCount = keywords.filter(k => issueText.includes(k)).length;
      if (matchCount >= Math.ceil(keywords.length * 0.4)) {
        return issue;
      }
    }
    return null;
  } catch (err) {
    log.warn(`Failed to check existing issues: ${err.message}`);
    return null;
  }
}

/** Create a GitHub issue. */
async function createIssue(title, body, labels = []) {
  if (CONFIG.dryRun) {
    log.info(`[DRY RUN] Would create issue: "${title}"`);
    log.info(`  Labels: ${labels.join(', ') || '(none)'}`);
    log.info(`  Body preview: ${body.slice(0, 100).replace(/\n/g, ' ')}...`);
    return { html_url: '(dry-run)' };
  }

  // Check for duplicates first
  const existing = await findExistingIssue(title);
  if (existing) {
    log.info(`Skipping duplicate issue: "${title}" (already exists as #${existing.number})`);
    return null;
  }

  try {
    const issue = await ghRequest('POST', `/repos/${CONFIG.repository}/issues`, {
      title,
      body,
      labels,
    });
    log.info(`Created issue #${issue.number}: ${issue.html_url}`);
    return issue;
  } catch (err) {
    log.error(`Failed to create issue: ${err.message}`);
    return null;
  }
}

// ── Analysis Functions ───────────────────────────────────────────────────────

/**
 * Use LLM to analyze the codebase for potential issues.
 * Returns a list of { title, body, labels } objects.
 */
async function analyzeCodebaseForIssues() {
  log.title('PHASE 1: Repository Codebase Analysis');

  // Gather context
  const structure = getProjectStructure();
  const keyFiles = getKeySourceFiles();
  const outdatedDeps = checkOutdatedDeps();
  const comments = scanForComments();
  const untestedFiles = checkTestCoverage();
  const recentActivity = getRecentActivity();

  // Read key configuration files
  const packageJson = readRepoFile('package.json');
  const tsconfig = readRepoFile('tsconfig.json') || '(none)';

  // Read a sample of key source files for deeper analysis
  const sampleFiles = keyFiles.slice(0, 15);
  const fileContents = {};
  for (const file of sampleFiles) {
    const content = readRepoFile(file);
    if (content) {
      // Only include non-trivial files
      if (content.length > 100 && content.length < 25000) {
        fileContents[file] = content;
      }
    }
  }

  // Build the analysis prompt
  const fileList = Object.entries(fileContents)
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join('\n\n');

  const outdatedSection = outdatedDeps
    ? outdatedDeps.map(d => `- ${d.name}: ${d.current} → ${d.latest}`).join('\n')
    : 'No outdated dependencies found.';

  const commentsSection = Object.entries(comments)
    .map(([cat, items]) => `[${cat}] (${items.length} occurrences):\n${items.slice(0, 10).join('\n')}`)
    .join('\n\n');

  const untestedSection = untestedFiles.length > 0
    ? untestedFiles.map(f => `- ${f}`).join('\n')
    : 'No untested files found (all key files have tests).';

  const systemPrompt = `You are a senior code reviewer. Your entire response must be ONLY a valid JSON array — no other text, no markdown, no code fences, no reasoning, no explanation.

Rules:
- Identify MAX 5 real issues in the codebase provided below
- For each issue: { "title": "...", "body": "...", "severity": "CRITICAL|HIGH|MEDIUM|LOW" }
- "body" is a GitHub Markdown description with code references
- Focus on: bugs, security, performance, outdated deps, architecture problems
- Only report real, impactful issues`;

  const userPrompt = `## Project Structure
\`\`\`
${structure.slice(0, 3000)}
\`\`\`

## Key Source Files (${Object.keys(fileContents).length} files)
${fileList.slice(0, 60000)}

## Outdated Dependencies
${outdatedSection}

## Annotated Comments (TODO/FIXME/etc.)
${commentsSection}

## Untested Files
${untestedSection}

## Recent Activity (7 days)
${recentActivity}

## package.json
${packageJson ? packageJson.slice(0, 3000) : 'N/A'}

Please analyze and return the top codebase issues as a JSON array.`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 128000, temperature: 0.2 });

    // Parse JSON from response
    const issues = extractJSONArray(response);
    if (!issues) {
      log.warn('Could not parse LLM response as JSON array. Raw response:');
      log.raw(response.slice(0, 500));
      return [];
    }

    log.info(`LLM identified ${issues.length} potential codebase issues.`);
    return issues
      .filter(issue => issue && issue.title && issue.body)
      .map(issue => ({
        title: String(issue.title),
        body: String(issue.body),
        labels: ['code-quality', `severity-${(issue.severity || 'MEDIUM').toLowerCase()}`],
      }));
  } catch (err) {
    log.error(`Codebase analysis failed: ${err.message}`);
    return [];
  }
}

/**
 * Research similar code agent tools and identify feature gaps.
 * Returns a list of { title, body, labels } objects.
 */
async function researchCompetitors() {
  log.title('PHASE 2: Competitor & Market Research');

  // Get current project info
  const packageJson = JSON.parse(readRepoFile('package.json') || '{}');
  const currentVersion = packageJson.version || 'unknown';

  const systemPrompt = `You are a product researcher and competitive analyst for developer tools. You specialize in AI coding agents (code agents) and stay up-to-date with their features.

Your task is to research the LATEST features and optimizations in similar AI code agent tools, and identify feature gaps or improvement opportunities for myclaude.

Consider these tools (and any others you know):
- Claude Code (Anthropic)
- Cursor AI
- GitHub Copilot / Copilot Chat
- Windsurf (Codeium)
- Aider (paul-gauthier/aider)
- Continue.dev
- OpenHands (formerly OpenDevin)
- Cline (cline/cline)
- Tabby
- Sourcegraph Cody
- CodeGemma / CodeLlama based tools

For each actionable finding, provide:
- What the competitor does that myclaude doesn't (or does differently)
- Why it matters (user impact)
- Implementation complexity estimate
- Relevant code areas in myclaude that would need changes

Return your response as a JSON array of objects:
[{ "title": "...", "body": "...", "priority": "HIGH|MEDIUM|LOW" }]

The "body" should be a detailed GitHub issue description in Markdown, including:
- What the competing tool does
- How it benefits users
- Suggested approach for myclaude
- Any relevant references/links

MAX 5 findings — only the most impactful ones.`;

  const userPrompt = `My project "myclaude" (v${currentVersion}) is an open-source AI coding assistant running in the terminal. It's a fork/rebrand of Claude Code.

Key features:
- TUI with React Ink (themed, Vim mode, syntax highlighting)
- AI chat with multi-model support (Anthropic, Bedrock, Vertex, Foundry)
- 76+ slash commands, 246+ built-in skills
- BUDDY pet system (gamified coding companion)
- Achievement system
- Frontend TDD workflow
- Git Flow integration
- Plugin & MCP server support
- ECC (Enhanced Command Center)

Repository: https://github.com/${CONFIG.repository}

Please research similar code agent tools and identify the most impactful feature gaps or improvements myclaude could adopt. Focus on features that:
1. Competitors have launched in the last 3-6 months
2. Would provide clear user value
3. Are feasible to implement in an open-source terminal-based tool

Return findings as a JSON array.`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 128000, temperature: 0.4 });

    const findings = extractJSONArray(response);
    if (!findings) {
      log.warn('Could not parse LLM response as JSON array for competitor research. Raw:');
      log.raw(response.slice(0, 500));
      return [];
    }

    log.info(`LLM identified ${findings.length} potential feature improvements from competitor research.`);
    return findings
      .filter(finding => finding && finding.title && finding.body)
      .map(finding => ({
        title: String(finding.title),
        body: String(finding.body),
        labels: ['feature-request', 'competitor-research', `priority-${(finding.priority || 'MEDIUM').toLowerCase()}`],
      }));
  } catch (err) {
    log.error(`Competitor research failed: ${err.message}`);
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log.title('ISSUE SCANNER STARTING');
  log.info(`Repository: ${CONFIG.repository}`);
  log.info(`Model: ${CONFIG.llmModelName}`);
  log.info(`Dry run: ${CONFIG.dryRun}`);
  log.info(`Max issues: ${CONFIG.maxIssues}`);

  if (!CONFIG.llmApiKey) {
    log.error('LLM_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  if (!CONFIG.ghToken && !CONFIG.dryRun) {
    log.error('GH_TOKEN is not set and not in dry-run mode. Aborting.');
    process.exit(1);
  }

  if (!CONFIG.ghToken) {
    log.warn('GH_TOKEN is not set. Running in dry-run mode (no GitHub API calls).');
    CONFIG.dryRun = true;
  }

  if (!CONFIG.repository) {
    log.error('GITHUB_REPOSITORY is not set. Aborting.');
    process.exit(1);
  }

  const allIssues = [];

  // Phase 1: Codebase Analysis
  try {
    const codeIssues = await analyzeCodebaseForIssues();
    allIssues.push(...codeIssues);
  } catch (err) {
    log.error(`Phase 1 (codebase analysis) failed: ${err.message}`);
  }

  // Phase 2: Competitor Research
  try {
    const competitorIssues = await researchCompetitors();
    allIssues.push(...competitorIssues);
  } catch (err) {
    log.error(`Phase 2 (competitor research) failed: ${err.message}`);
  }

  // Create issues
  log.title(`CREATING ISSUES (${Math.min(allIssues.length, CONFIG.maxIssues)} of ${allIssues.length})`);

  if (allIssues.length === 0) {
    log.info('No issues to create. Everything looks good!');
    return;
  }

  const issuesToCreate = allIssues.slice(0, CONFIG.maxIssues);
  let created = 0;
  let skipped = 0;

  for (const issue of issuesToCreate) {
    const result = await createIssue(issue.title, issue.body, issue.labels);
    if (result) {
      created++;
    } else {
      skipped++;
    }
    // Small delay between issues to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  log.title('SCAN COMPLETE');
  log.info(`Issues created: ${created}`);
  log.info(`Issues skipped (duplicates): ${skipped}`);
  log.info(`Total issues considered: ${allIssues.length}`);
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});