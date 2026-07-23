import type { ClientOptions } from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { getSessionId } from '../../bootstrap/state.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { Mutex } from 'async-mutex'

/**
 * Parse SSE event data lines into a JSON object.
 * Extracts all `data: ` lines from an event (excluding `data: [DONE]`),
 * joins them with newlines, and parses the result as JSON.
 * Returns null if no data lines are found or if parsing fails.
 */
function parseEventData(event: string): unknown | null {
  const dataLines: string[] = []
  for (const line of event.split('\n')) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      dataLines.push(line.slice(6))
    }
  }
  if (dataLines.length === 0) return null
  try {
    return jsonParse(dataLines.join('\n'))
  } catch {
    return null
  }
}

// Warn at module load if sensitive env vars are set
if (process.env.USER_TYPE === 'ant' && process.env.DUMP_PROMPTS === '1') {
  logForDebugging(
    'DUMP_PROMPTS is enabled. This will write full API payloads (including system prompts, user messages, and tool definitions) to the filesystem. This is intended for debugging only and should NOT be used in production.',
    { level: 'warn' },
  )
}

function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex')
}

// Cache last few API requests for ant users (e.g., for /issue command)
const MAX_CACHED_REQUESTS = 5
const cachedApiRequests: Array<{ timestamp: string; request: unknown }> = []

type DumpState = {
  initialized: boolean
  messageCountSeen: number
  lastInitDataHash: string
  // Cheap proxy for change detection — skips the expensive stringify+hash
  // when model/tools/system are structurally identical to the last call.
  lastInitFingerprint: string
}

// Track state per session to avoid duplicating data
const dumpState = new Map<string, DumpState>()

// Queue to serialize dumpRequest calls per session to prevent race conditions
const dumpRequestQueue = new Map<string, Array<() => Promise<void>>>()
// Per-session promise to serialize queue processing (replaces fragile flag-based mechanism)
const processingPromises = new Map<string, Promise<void>>()
// Per-session mutex to protect the check-and-set of processingPromises from race conditions
const enqueueMutexes = new Map<string, Mutex>()

function enqueueDumpRequest(agentIdOrSessionId: string, callback: () => Promise<void>): void {
  if (!dumpRequestQueue.has(agentIdOrSessionId)) {
    dumpRequestQueue.set(agentIdOrSessionId, [])
  }
  dumpRequestQueue.get(agentIdOrSessionId)!.push(callback)
  
  // Use a per-session mutex to ensure the check-and-set of processingPromises
  // is atomic. This prevents two concurrent calls from both passing the has() check
  // and creating duplicate processing loops.
  const mutex = enqueueMutexes.get(agentIdOrSessionId) ?? new Mutex()
  enqueueMutexes.set(agentIdOrSessionId, mutex)
  
  mutex.runExclusive(async () => {
    if (!processingPromises.has(agentIdOrSessionId)) {
      const promise = (async () => {
        while (true) {
          const queue = dumpRequestQueue.get(agentIdOrSessionId)
          if (!queue || queue.length === 0) {
            break
          }
          const cb = queue.shift()!
          try {
            await cb()
          } catch (err) {
            logForDebugging(`dumpPrompts.processQueue: callback threw: ${err}`, { level: 'error' })
          }
        }
      })()
        .catch((err) => {
          logError(`processQueue: failed for ${agentIdOrSessionId}`, err)
          dumpRequestQueue.delete(agentIdOrSessionId)
        })
        .finally(() => {
          processingPromises.delete(agentIdOrSessionId)
        })
      processingPromises.set(agentIdOrSessionId, promise)
    }
  }).catch((err) => {
    logError(`enqueueDumpRequest: mutex acquisition failed for ${agentIdOrSessionId}`, err)
  })
}

export function getLastApiRequests(): Array<{
  timestamp: string
  request: unknown
}> {
  return [...cachedApiRequests]
}

export function clearApiRequestCache(): void {
  cachedApiRequests.length = 0
}

export function clearDumpState(agentIdOrSessionId: string): void {
  dumpState.delete(agentIdOrSessionId)
}

export function clearAllDumpState(): void {
  dumpState.clear()
}

export function addApiRequestToCache(requestData: unknown): void {
  if (process.env.USER_TYPE !== 'ant') return
  
  // Extract only metadata to prevent sensitive data from being cached in memory
  // This protects user prompts and system instructions from being accessible
  // via getLastApiRequests() in case of memory compromise
  const metadata = {
    timestamp: new Date().toISOString(),
    request: {
      model: (requestData as Record<string, unknown>).model as string,
    },
  }
  
  cachedApiRequests.push(metadata)
  if (cachedApiRequests.length > MAX_CACHED_REQUESTS) {
    cachedApiRequests.shift()
  }
}

export function getDumpPromptsPath(agentIdOrSessionId?: string): string {
  return join(
    getClaudeConfigHomeDir(),
    'dump-prompts',
    `${agentIdOrSessionId ?? getSessionId()}.jsonl`,
  )
}

async function appendToFile(filePath: string, entries: string[]): Promise<void> {
  if (entries.length === 0) return
  try {
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, entries.join('\n') + '\n')
  } catch (err) {
    logForDebugging(`dumpPrompts.appendToFile error: ${err}`, { level: 'error' })
  }
}

function initFingerprint(req: Record<string, unknown>): string {
  const tools = req.tools as Array<{ name?: string }> | undefined
  const system = req.system as unknown[] | string | undefined
  const sysLen =
    typeof system === 'string'
      ? system.length
      : Array.isArray(system)
        ? system.reduce(
            (n: number, b) => n + ((b as { text?: string }).text?.length ?? 0),
            0,
          )
        : 0
  const toolNames = tools?.map(t => t.name ?? '').join(',') ?? ''
  return `${req.model}|${toolNames}|${sysLen}`
}

async function dumpRequest(
  body: string,
  ts: string,
  state: DumpState,
  filePath: string,
): Promise<void> {
  // Disable in production to prevent accidental data leakage
  if (process.env.NODE_ENV === 'production') return

  // Only parse and cache if USER_TYPE is ant (needed for caching or writing to disk)
  if (process.env.USER_TYPE !== 'ant') return

  try {
    const req = jsonParse(body) as Record<string, unknown>
    addApiRequestToCache(req)

    // Require DUMP_PROMPTS=1 to write to disk
    if (process.env.DUMP_PROMPTS !== '1') return

    // Warn about potential sensitive data exposure
    logForDebugging(
      'DUMP_PROMPTS is enabled. This will write full API payloads (including system prompts, user messages, and tool definitions) to the filesystem. This is intended for debugging only and should NOT be used in production.',
      { level: 'warn' },
    )
    const entries: string[] = []
    const messages = (req.messages ?? []) as Array<{ role?: string }>

    // Write init data (system, tools, metadata) on first request,
    // and a system_update entry whenever it changes.
    // Cheap fingerprint first: system+tools don't change between turns,
    // so skip the 300ms stringify when the shape is unchanged.
    const fingerprint = initFingerprint(req)
    let initDataStr: string | undefined
    let initDataHash: string | undefined
    const shouldWriteInitData = !state.initialized || fingerprint !== state.lastInitFingerprint
    if (shouldWriteInitData) {
      const { messages: _, ...initData } = req
      initDataStr = jsonStringify(initData)
      initDataHash = hashString(initDataStr)
    }

    // Write only new user messages (assistant messages captured in response)
    // (computed before state mutation to avoid partial update if jsonStringify throws)
    for (const msg of messages.slice(state.messageCountSeen)) {
      if (msg.role === 'user') {
        try {
          entries.push(
            jsonStringify({ type: 'message', timestamp: ts, data: msg }),
          )
        } catch (err) {
          logError(`dumpPrompts.dumpRequest: failed to stringify message: ${err}`)
        }
      }
    }

    // Mutate state after all fallible computations are complete
    if (shouldWriteInitData) {
      state.lastInitFingerprint = fingerprint
      if (!state.initialized) {
        state.initialized = true
        state.lastInitDataHash = initDataHash!
        // Reuse initDataStr rather than re-serializing initData inside a wrapper.
        // timestamp from toISOString() contains no chars needing JSON escaping.
        entries.push(
          `{"type":"init","timestamp":"${ts}","data":${initDataStr!}}`,
        )
      } else if (initDataHash! !== state.lastInitDataHash) {
        state.lastInitDataHash = initDataHash!
        entries.push(
          `{"type":"system_update","timestamp":"${ts}","data":${initDataStr!}}`,
        )
      }
    }
    state.messageCountSeen = messages.length

    await appendToFile(filePath, entries)
  } catch (err) {
    logForDebugging(`dumpPrompts.dumpRequest error: ${err}`, { level: 'error' })
  }
}

export function createDumpPromptsFetch(
  agentIdOrSessionId: string,
): ClientOptions['fetch'] {
  const filePath = getDumpPromptsPath(agentIdOrSessionId)

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const state = dumpState.get(agentIdOrSessionId) ?? {
      initialized: false,
      messageCountSeen: 0,
      lastInitDataHash: '',
      lastInitFingerprint: '',
    }
    dumpState.set(agentIdOrSessionId, state)

    let timestamp: string | undefined

    if (init?.method === 'POST' && init.body) {
      // Skip enqueue entirely in production or for non-ant users —
      // the dumpRequest function immediately returns in those cases,
      // so the enqueue would just create unnecessary overhead.
      if (process.env.NODE_ENV !== 'production' && process.env.USER_TYPE === 'ant') {
        timestamp = new Date().toISOString()
        // Parsing + stringifying the request (system prompt + tool schemas = MBs)
        // takes hundreds of ms. Defer so it doesn't block the actual API call —
        // this is debug tooling for /issue, not on the critical path.
        // Use a per-session queue to avoid race conditions on state.
        enqueueDumpRequest(agentIdOrSessionId, async () => {
          await dumpRequest(init.body as string, timestamp!, state, filePath)
        })
      }
    }

    // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
    const response = await globalThis.fetch(input, init)

    // Save response async — require both USER_TYPE=ant and DUMP_PROMPTS=1
    // Also disable in production to prevent accidental data leakage
    if (timestamp && response.ok && process.env.NODE_ENV !== 'production' && process.env.USER_TYPE === 'ant' && process.env.DUMP_PROMPTS === '1') {
      const cloned = response.clone()
      ;(async () => {
        try {
          const isStreaming = cloned.headers
            .get('content-type')
            ?.includes('text/event-stream')

          let data: unknown
          if (isStreaming && cloned.body) {
            // Parse SSE stream into chunks incrementally to avoid memory exhaustion.
            // Instead of accumulating the entire response body, we write chunks
            // directly to the file as they arrive.
            const reader = cloned.body.getReader()
            const decoder = new TextDecoder()
            // Use an array of string chunks to avoid O(n²) string concatenation.
            // Instead of appending to a single string (which copies the entire buffer
            // on every iteration), we collect chunks in an array and only join when
            // we need to search for complete events.
            const chunks: string[] = []
            let incomplete = ''
            const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10MB limit to prevent memory exhaustion
            const chunkEntries: string[] = []
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                const decoded = decoder.decode(value, { stream: true })
                chunks.push(decoded)
                
                // Only join the accumulated chunks (plus the incomplete trailing part)
                // when we need to search for complete events. This avoids copying
                // the entire buffer on every iteration.
                const combined = incomplete + chunks.join('')
                chunks.length = 0
                
                const lastDoubleNewline = combined.lastIndexOf('\n\n')
                if (lastDoubleNewline !== -1) {
                  // There are complete events we can process
                  const completeEvents = combined.slice(0, lastDoubleNewline)
                  incomplete = combined.slice(lastDoubleNewline + 2)
                  
                  // Process the complete events
                  for (const event of completeEvents.split('\n\n')) {
                    const chunk = parseEventData(event)
                    if (chunk !== null) {
                      chunkEntries.push(jsonStringify({ type: 'chunk', timestamp, data: chunk }))
                      if (chunkEntries.length >= 50) {
                        await appendToFile(filePath, chunkEntries)
                        chunkEntries.length = 0
                      }
                    }
                  }
                  
                  // Prevent unbounded buffer growth — truncate at line boundary
                  // to preserve event integrity
                  if (incomplete.length > MAX_BUFFER_SIZE) {
                    logForDebugging('dumpPrompts: incomplete buffer exceeds max size, truncating', { level: 'warn' })
                    const truncateStart = incomplete.length - MAX_BUFFER_SIZE
                    const lastNewline = incomplete.lastIndexOf('\n', truncateStart)
                    if (lastNewline !== -1 && lastNewline > truncateStart - 1000) {
                      incomplete = incomplete.slice(lastNewline + 1)
                    } else {
                      incomplete = incomplete.slice(-MAX_BUFFER_SIZE)
                    }
                  }
                } else {
                  // No complete events found — keep everything as incomplete
                  incomplete = combined
                  
                  // Prevent unbounded buffer growth — truncate at line boundary
                  // to preserve event integrity
                  if (incomplete.length > MAX_BUFFER_SIZE) {
                    logForDebugging('dumpPrompts: buffer exceeded max size, truncating', { level: 'warn' })
                    const truncateStart = incomplete.length - MAX_BUFFER_SIZE
                    const lastNewline = incomplete.lastIndexOf('\n', truncateStart)
                    if (lastNewline !== -1 && lastNewline > truncateStart - 1000) {
                      incomplete = incomplete.slice(lastNewline + 1)
                    } else {
                      incomplete = incomplete.slice(-MAX_BUFFER_SIZE)
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock()
            }
            // Process any remaining data in the buffer.
            // The incomplete buffer contains the trailing data after the last \n\n.
            // This could be a complete event (without trailing \n\n) or a partial event.
            // Try to parse it as a complete event first; if that fails, include
            // the raw data as a best-effort to avoid silently dropping data.
            if (incomplete.trim()) {
              const chunk = parseEventData(incomplete)
              if (chunk !== null) {
                chunkEntries.push(jsonStringify({ type: 'chunk', timestamp, data: chunk }))
              } else {
                // Stream ended with a partial/incomplete event — include raw data
                // so it's not silently lost during debugging.
                chunkEntries.push(jsonStringify({ type: 'chunk', timestamp, data: incomplete }))
              }
            }
            // Flush any remaining chunks
            if (chunkEntries.length > 0) {
              await appendToFile(filePath, chunkEntries)
            }
          } else {
            data = await cloned.json()

            await appendToFile(filePath, [
              jsonStringify({ type: 'response', timestamp, data }),
            ])
          }
        } catch (err) {
          logError(`dumpPrompts.response handler error: ${err}`)
        }
      })().catch((err: unknown) => {
        logError(`dumpPrompts.response handler unhandled rejection: ${err}`)
      })
    }

    return response
  }
}
