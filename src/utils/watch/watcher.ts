import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import chokidar, { type FSWatcher } from 'chokidar'
import picomatch from 'picomatch'
import type { WatchConfig } from './watchConfig.js'

const execFileAsync = promisify(execFile)

export type WatchMode = 'default' | 'test' | 'lint' | 'tdd'

export type WatchEventKind = 'change' | 'add' | 'unlink'

export type WatchEvent = {
  kind: WatchEventKind
  path: string
  mode: WatchMode
  trigger: 'test' | 'lint' | 'build' | null
}

export type WatchSessionOptions = {
  projectRoot: string
  config: WatchConfig
  mode: WatchMode
  onEvent?: (event: WatchEvent) => void | Promise<void>
  onStatus?: (status: WatchSessionStatus) => void
}

export type WatchSessionStatus = {
  active: boolean
  mode: WatchMode
  projectRoot: string
  iterations: number
  maxIterations: number
  lastEventAt: number | null
  lastEventPath: string | null
  startedAt: number | null
}

export function matchesGlob(path: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return false
  const normalized = path.replace(/\\/g, '/')
  return patterns.some((pattern) => {
    try {
      return picomatch(pattern, { dot: true })(normalized)
    } catch {
      return false
    }
  })
}

export function classifyPath(
  path: string,
  config: WatchConfig,
): 'test' | 'lint' | 'build' | null {
  if (matchesGlob(path, config.triggers.test)) return 'test'
  if (matchesGlob(path, config.triggers.lint)) return 'lint'
  if (matchesGlob(path, config.triggers.build)) return 'build'
  return null
}

export class WatchSession {
  private watcher: FSWatcher | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private pendingPath: string | null = null
  private pendingKind: WatchEventKind | null = null
  private lastEventAt = 0
  private iterations = 0
  private startedAt: number | null = null
  private stopped = false

  constructor(private readonly options: WatchSessionOptions) {}

  get status(): WatchSessionStatus {
    return {
      active: this.watcher !== null && !this.stopped,
      mode: this.options.mode,
      projectRoot: this.options.projectRoot,
      iterations: this.iterations,
      maxIterations: this.options.config.maxIterations,
      lastEventAt: this.lastEventAt || null,
      lastEventPath: this.pendingPath,
      startedAt: this.startedAt,
    }
  }

  async start(): Promise<void> {
    if (this.watcher) return
    const { config, projectRoot } = this.options
    this.startedAt = Date.now()
    this.stopped = false

    const include = config.include.length > 0 ? config.include : ['**/*']
    const exclude = config.exclude.map((pattern) => `${projectRoot}/${pattern}`)

    this.watcher = chokidar.watch(include, {
      cwd: projectRoot,
      ignored: exclude,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: Math.max(50, Math.min(config.debounceMs, 1000)),
        pollInterval: 50,
      },
    })

    const handleChange = (kind: WatchEventKind) => (path: string) => {
      this.enqueue(kind, path)
    }

    this.watcher.on('change', handleChange('change'))
    this.watcher.on('add', handleChange('add'))
    this.watcher.on('unlink', handleChange('unlink'))
  }

  private enqueue(kind: WatchEventKind, path: string): void {
    if (this.stopped) return
    this.pendingKind = kind
    this.pendingPath = path

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.flush()
    }, this.options.config.debounceMs)
  }

  private async flush(): Promise<void> {
    if (this.stopped || !this.pendingPath || !this.pendingKind) return
    const now = Date.now()
    const elapsed = now - this.lastEventAt
    const cooldownRemaining = this.options.config.cooldownMs - elapsed
    if (cooldownRemaining > 0 && this.lastEventAt > 0) {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null
        void this.flush()
      }, cooldownRemaining)
      return
    }

    if (this.iterations >= this.options.config.maxIterations) {
      this.options.onStatus?.(this.status)
      await this.stop()
      return
    }

    const trigger = classifyPath(this.pendingPath, this.options.config)
    const event: WatchEvent = {
      kind: this.pendingKind,
      path: this.pendingPath,
      mode: this.options.mode,
      trigger,
    }
    this.lastEventAt = now
    this.iterations += 1
    this.pendingPath = null
    this.pendingKind = null

    try {
      await this.options.onEvent?.(event)
    } catch {
      // Swallow — caller can inspect status.iterations.
    }
    this.options.onStatus?.(this.status)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.options.onStatus?.(this.status)
  }

  async getDiff(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['diff'], {
        cwd: this.options.projectRoot,
        maxBuffer: 1024 * 1024,
      })
      return stdout
    } catch {
      return ''
    }
  }
}

export function createWatchSession(
  options: WatchSessionOptions,
): WatchSession {
  return new WatchSession(options)
}
