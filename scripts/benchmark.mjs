#!/usr/bin/env bun
/**
 * Multi-Model Benchmarking & Comparison Mode (issue #97).
 *
 * Runs the SAME task/prompt against multiple configured LLM models and prints
 * a comparison table (output preview, latency, token usage, cost estimate),
 * helping users pick the best model for a task.
 *
 * Usage:
 *   bun run scripts/benchmark.mjs --prompt "Write a quicksort in Python" \
 *     --models "claude/anthropic-claude-sonnet-4-5,openai/glm-4.5" \
 *     --max-tokens 2000
 *
 * Model format: "<prefix>/<modelName>", where prefix selects the endpoint:
 *   claude|anthropic → Anthropic Messages API (requires ANTHROPIC_API_KEY)
 *   openai|gpt|o1|o3 → OpenAI-compatible /chat/completions
 *   glm              → Zhipu GLM (LLM_API_KEY + LLM_API_BASE, default 智谱)
 *
 * Env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY / LLM_API_KEY, LLM_API_BASE.
 */

import { performance } from 'node:perf_hooks'

const args = process.argv.slice(2)

function argValue(name, def = undefined) {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : def
}

const PROMPT =
  argValue('--prompt') ||
  'Write a concise Python function to compute the Fibonacci sequence, with a short docstring.'
const MODELS =
  argValue('--models') ||
  process.env.BENCHMARK_MODELS ||
  'openai/glm-4.5'
const MAX_TOKENS = Number(argValue('--max-tokens') || 1024)
const TEMPERATURE = Number(argValue('--temperature') || 0.2)
const TIMEOUT_MS = Number(argValue('--timeout') || 120000)

// Rough per-1K-token USD pricing (input/output) for cost estimation.
const PRICING = {
  'claude-sonnet-4-5': [3, 15],
  'claude-opus-4': [15, 75],
  'claude-haiku-4': [1, 5],
  'glm-4.5': [0.8, 3.2],
}

function resolveEndpoint(base, modelPrefix) {
  const clean = (base || '').replace(/\/+$/, '')
  if (modelPrefix === 'claude' || modelPrefix === 'anthropic') {
    return 'https://api.anthropic.com/v1/messages'
  }
  if (clean.endsWith('/v1') || clean.endsWith('/chat/completions')) {
    return clean
  }
  return `${clean}/v1/chat/completions`
}

async function callLLM(modelSpec, label) {
  const [prefix, ...rest] = modelSpec.split('/')
  const modelName = rest.join('/') || modelSpec
  const isAnthropic = prefix === 'claude' || prefix === 'anthropic'

  let apiKey, apiBase
  if (isAnthropic) {
    apiKey = process.env.ANTHROPIC_API_KEY
    apiBase = 'https://api.anthropic.com/v1/messages'
  } else {
    apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
    apiBase = resolveEndpoint(
      process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas',
      prefix,
    )
  }
  if (!apiKey) {
    return { label, error: `No API key for prefix '${prefix}' (${label})` }
  }

  const payload = isAnthropic
    ? {
        model: modelName,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content: PROMPT }],
      }
    : {
        model: modelName,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content: PROMPT }],
      }

  const headers = isAnthropic
    ? {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      }
    : { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  const started = performance.now()
  try {
    const res = await fetch(apiBase, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const elapsedMs = performance.now() - started
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { label, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
    }
    const data = await res.json()

    let text = ''
    let inTokens = 0
    let outTokens = 0
    if (isAnthropic) {
      text = (data.content || []).map(b => b.text || '').join('')
      inTokens = data.usage?.input_tokens ?? 0
      outTokens = data.usage?.output_tokens ?? 0
    } else {
      text = data.choices?.[0]?.message?.content ?? ''
      inTokens = data.usage?.prompt_tokens ?? 0
      outTokens = data.usage?.completion_tokens ?? 0
    }

    const pricing = PRICING[modelName] || [0, 0]
    const costUsd =
      (inTokens / 1000) * pricing[0] + (outTokens / 1000) * pricing[1]

    return {
      label,
      modelName,
      elapsedMs,
      inTokens,
      outTokens,
      costUsd,
      preview: text.slice(0, 200),
      length: text.length,
    }
  } catch (e) {
    return { label, error: `Request failed: ${e.message}` }
  }
}

function fmtDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
}

async function main() {
  const models = MODELS.split(',')
    .map(s => s.trim())
    .filter(Boolean)
  console.log(`\n=== Multi-Model Benchmark (issue #97) ===`)
  console.log(`Prompt: ${PROMPT.slice(0, 120)}${PROMPT.length > 120 ? '…' : ''}`)
  console.log(`Models: ${models.join(', ')}\n`)

  const results = await Promise.all(models.map(m => callLLM(m, m)))

  console.log('Model                          Latency    In-tok  Out-tok  Cost($)  Result')
  console.log('─'.repeat(90))
  for (const r of results) {
    if (r.error) {
      console.log(`${r.label.padEnd(30)}  ${r.error}`)
      continue
    }
    const cost = r.costUsd ? `$${r.costUsd.toFixed(4)}` : '-'
    console.log(
      `${r.label.padEnd(30)}  ${fmtDuration(r.elapsedMs).padEnd(9)}  ` +
        `${String(r.inTokens).padEnd(7)} ${String(r.outTokens).padEnd(8)} ` +
        `${cost.padEnd(8)} ${r.length} chars`,
    )
    console.log(`    > ${r.preview.replace(/\n/g, ' ').slice(0, 150)}`)
  }

  const ok = results.filter(r => !r.error)
  if (ok.length >= 2) {
    const best = [...ok].sort((a, b) => a.elapsedMs - b.elapsedMs)[0]
    console.log(`\nFastest: ${best.label} (${fmtDuration(best.elapsedMs)})`)
  } else if (ok.length === 0) {
    console.log('\nNo model succeeded — check API keys/env vars.')
    process.exitCode = 1
  }
  console.log('')
}

main()
