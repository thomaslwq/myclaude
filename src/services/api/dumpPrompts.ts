import type { ClientOptions } from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { getSessionId } from 'src/bootstrap/state.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'

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
// Track which sessions are currently being processed to avoid concurrent processing
const processingQueues = new Set<string>()

function enqueueDumpRequest(agentIdOrSessionId: string, callback: () => Promise<void>): void {
  if (!dumpRequestQueue.has(agentIdOrSessionId)) {
    dumpRequestQueue.set(agentIdOrSessionId, [])
  }
  dumpRequestQueue.get(agentIdOrSessionId)!.push(callback)
  
  // Start processing the queue only if it's not already being processed
  // This prevents race conditions where concurrent enqueue calls
  // would trigger multiple processQueue invocations for the same session
  if (!processingQueues.has(agentIdOrSessionId)) {
    processingQueues.add(agentIdOrSessionId)
    processQueue(agentIdOrSessionId)
  }
}

async function processQueue(agentIdOrSessionId: string): Promise<void> {
  processingQueues.add(agentIdOrSessionId)
  
  const queue = dumpRequestQueue.get(agentIdOrSessionId)
  if (!queue || queue.length === 0) {
    dumpRequestQueue.delete(agentIdOrSessionId)
    processingQueues.delete(agentIdOrSessionId)
    return
  }
  
  const callback = queue.shift()!
  await callback()
  
  // Process the next item in the queue if there are more
  // Using setImmediate to avoid stack overflow with rapid enqueues
  if (queue.length > 0) {
    setImmediate(() => processQueue(agentIdOrSessionId))
  } else {
    dumpRequestQueue.delete(agentIdOrSessionId)
    processingQueues.delete(agentIdOrSessionId)
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
  try {
    const req = jsonParse(body) as Record<string, unknown>
    addApiRequestToCache(req)

    // Require both USER_TYPE=ant and DUMP_PROMPTS=1 to write to disk
    if (process.env.USER_TYPE !== 'ant' || process.env.DUMP_PROMPTS !== '1') return
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
      timestamp = new Date().toISOString()
      // Parsing + stringifying the request (system prompt + tool schemas = MBs)
      // takes hundreds of ms. Defer so it doesn't block the actual API call —
      // this is debug tooling for /issue, not on the critical path.
      // Use a per-session queue to avoid race conditions on state.
      enqueueDumpRequest(agentIdOrSessionId, async () => {
        await dumpRequest(init.body as string, timestamp!, state, filePath)
      })
    }

    // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
    const response = await globalThis.fetch(input, init)

    // Save response async — require both USER_TYPE=ant and DUMP_PROMPTS=1
    if (timestamp && response.ok && process.env.USER_TYPE === 'ant' && process.env.DUMP_PROMPTS === '1') {
      const cloned = response.clone()
      ;(async () => {
        try {
          const isStreaming = cloned.headers
            .get('content-type')
            ?.includes('text/event-stream')

          let data: unknown
          if (isStreaming && cloned.body) {
            // Parse SSE stream into chunks incrementally to avoid memory exhaustion.
            // Instead of accumulating the entire response body, we keep only a small
            // trailing fragment for incomplete events and process complete events as
            // they arrive.
            const reader = cloned.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            const chunks: unknown[] = []
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                // Only keep the incomplete trailing part, not the entire accumulated buffer
                buffer += decoder.decode(value, { stream: true })
                
                // Process complete SSE events from the buffer
                const lastDoubleNewline = buffer.lastIndexOf('\n\n')
                if (lastDoubleNewline !== -1) {
                  const completeEvents = buffer.slice(0, lastDoubleNewline)
                  buffer = buffer.slice(lastDoubleNewline + 2) // Keep incomplete part
                  
                  for (const event of completeEvents.split('\n\n')) {
                    for (const line of event.split('\n')) {
                      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                          chunks.push(jsonParse(line.slice(6)))
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
            if (buffer.trim()) {
              for (const event of buffer.split('\n\n')) {
                for (const line of event.split('\n')) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      chunks.push(jsonParse(line.slice(6)))
                    } catch (err) {
                      logForDebugging(`dumpPrompts.SSE parse error: ${err}`, { level: 'error' })
                    }
                  }
                }
              }
            }
            data = { stream: true, chunks }
          } else {
            data = await cloned.json()
          }

          await appendToFile(filePath, [
            jsonStringify({ type: 'response', timestamp, data }),
          ])
        } catch (err) {
          try {
            logForDebugging(`dumpPrompts.response handler error: ${err}`, { level: 'error' })
          } catch {
            // Silently ignore if logForDebugging itself throws
          }
        }
      })().catch((err: unknown) => {
        logForDebugging(`dumpPrompts.response handler unhandled rejection: ${err}`, { level: 'error' })
      })
    }

    return response
  }
}
