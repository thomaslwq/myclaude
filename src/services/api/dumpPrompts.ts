import type { ClientOptions } from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { getSessionId } from '../../bootstrap/state.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'

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
// Per-session flag to prevent concurrent queue processing
const processingFlags = new Set<string>()

function enqueueDumpRequest(agentIdOrSessionId: string, callback: () => Promise<void>): void {
  if (!dumpRequestQueue.has(agentIdOrSessionId)) {
    dumpRequestQueue.set(agentIdOrSessionId, [])
  }
  dumpRequestQueue.get(agentIdOrSessionId)!.push(callback)
  
  // If not already processing this session's queue, start processing.
  // The flag check and set are synchronous (atomic in JavaScript), so concurrent
  // enqueues will only start one processing loop. The while loop inside
  // processQueue will pick up any items added while processing is ongoing.
  if (!processingFlags.has(agentIdOrSessionId)) {
    processingFlags.add(agentIdOrSessionId)
    // Call processQueue directly (non-awaited) to start processing immediately.
    // The async function will yield to the event loop at await points.
    processQueue(agentIdOrSessionId)
  }
}

async function processQueue(agentIdOrSessionId: string): Promise<void> {
  try {
    // Keep processing until the queue is empty. New items added while processing
    // will be picked up in subsequent iterations of the outer loop.
    // This iterative approach avoids stack growth from recursion.
    while (true) {
      // Inner loop: process all currently queued items
      while (true) {
        const queue = dumpRequestQueue.get(agentIdOrSessionId)
        if (!queue || queue.length === 0) {
          break
        }

        const callback = queue.shift()!
        try {
          await callback()
        } catch (err) {
          logForDebugging(`dumpPrompts.processQueue: callback threw: ${err}`, { level: 'error' })
        }
      }

      // Re-check if new items were added while we were processing.
      // NOTE: We check the queue BEFORE clearing the flag to avoid a race condition.
      // If we cleared the flag first, a new callback enqueued between the flag
      // deletion and the re-check would see the flag as not set, start a new
      // processQueue in enqueueDumpRequest, and then this re-check would also
      // start another processQueue — causing concurrent processing loops.
      const queue = dumpRequestQueue.get(agentIdOrSessionId)
      if (!queue || queue.length === 0) {
        // No items — clean up the queue and clear the flag, then exit
        dumpRequestQueue.delete(agentIdOrSessionId)
        processingFlags.delete(agentIdOrSessionId)
        return
      }
      // If items were added, continue the outer loop (no recursion needed)
    }
  } catch (err) {
    // If an unexpected error occurs, clean up so the queue is not permanently blocked
    logError(`processQueue: failed for ${agentIdOrSessionId}`, err)
    dumpRequestQueue.delete(agentIdOrSessionId)
    processingFlags.delete(agentIdOrSessionId)
  }
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
            // Use array of chunks to avoid O(n²) string concatenation
            const bufferChunks: string[] = []
            let bufferLength = 0
            const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10MB limit to prevent memory exhaustion
            const chunkEntries: string[] = []
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                // Push decoded chunk to array — O(1) amortized, avoids O(n²) string concatenation
                const decoded = decoder.decode(value, { stream: true })
                bufferChunks.push(decoded)
                bufferLength += decoded.length
                
                // Prevent unbounded buffer growth — if a single event exceeds the limit, skip it
                if (bufferLength > MAX_BUFFER_SIZE) {
                  logForDebugging('dumpPrompts: buffer exceeded max size, skipping event', { level: 'warn' })
                  bufferChunks.length = 0
                  bufferLength = 0
                  continue
                }
                
                // Only join the buffer when we need to search for complete events
                // The buffer is kept small (just the trailing incomplete part), so this is efficient
                const buffer = bufferChunks.join('')
                const lastDoubleNewline = buffer.lastIndexOf('\n\n')
                if (lastDoubleNewline !== -1) {
                  const completeEvents = buffer.slice(0, lastDoubleNewline)
                  const incomplete = buffer.slice(lastDoubleNewline + 2) // Keep incomplete part
                  bufferChunks.length = 0
                  bufferChunks.push(incomplete)
                  bufferLength = incomplete.length
                  
                  for (const event of completeEvents.split('\n\n')) {
                    for (const line of event.split('\n')) {
                      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                          const chunk = jsonParse(line.slice(6))
                          // Write chunk directly to file to avoid memory accumulation
                          chunkEntries.push(jsonStringify({ type: 'chunk', timestamp, data: chunk }))
                          // Flush to disk periodically to avoid unbounded memory growth
                          if (chunkEntries.length >= 50) {
                            await appendToFile(filePath, chunkEntries)
                            chunkEntries.length = 0
                          }
                        } catch (err) {
                          logForDebugging(`dumpPrompts.SSE parse error: ${err}`, { level: 'error' })
                        }
                      }
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock()
            }
            // Process any remaining data in the buffer
            const buffer = bufferChunks.join('')
            if (buffer.trim()) {
              for (const event of buffer.split('\n\n')) {
                for (const line of event.split('\n')) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const chunk = jsonParse(line.slice(6))
                      // Write chunk directly to file to avoid memory accumulation
                      chunkEntries.push(jsonStringify({ type: 'chunk', timestamp, data: chunk }))
                    } catch (err) {
                      logForDebugging(`dumpPrompts.SSE parse error: ${err}`, { level: 'error' })
                    }
                  }
                }
              }
            }
            // Flush any remaining chunks
            if (chunkEntries.length > 0) {
              await appendToFile(filePath, chunkEntries)
            }
            data = { stream: true, chunks: [] }
          } else {
            data = await cloned.json()
          }

          await appendToFile(filePath, [
            jsonStringify({ type: 'response', timestamp, data }),
          ])
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
