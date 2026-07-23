type QueueItem<T extends unknown[], R> = {
  args: T
  resolve: (value: R) => void
  reject: (reason?: unknown) => void
  context: unknown
}

/**
 * Creates a sequential execution wrapper for async functions to prevent race conditions.
 * Ensures that concurrent calls to the wrapped function are executed one at a time
 * in the order they were received, while preserving the correct return values.
 *
 * This is useful for operations that must be performed sequentially, such as
 * file writes or database updates that could cause conflicts if executed concurrently.
 *
 * The wrapper supports reentrancy: if the wrapped function calls back into the
 * sequential wrapper (e.g. during error recovery), the reentrant call will execute
 * immediately without deadlocking. This is safe because the sequential wrapper
 * already ensures that only one operation executes at a time per session, and
 * the reentrant call is executing within that same serialized context.
 *
 * @param fn - The async function to wrap with sequential execution
 * @returns A wrapped version of the function that executes calls sequentially
 */
export function sequential<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  const queue: QueueItem<T, R>[] = []
  let processing = false
  // Track the call depth of the wrapper function. When depth > 1,
  // it means the wrapper is being called reentrantly (from within
  // the wrapped function fn). This enables reentrant calls to execute
  // immediately without deadlocking.
  let depth = 0

  async function processQueue(): Promise<void> {
    if (processing) return
    if (queue.length === 0) return

    processing = true

    while (queue.length > 0) {
      const { args, resolve, reject, context } = queue.shift()!

      try {
        const result = await fn.apply(context, args)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    processing = false

    // Check if new items were added while we were processing
    if (queue.length > 0) {
      void processQueue()
    }
  }

  return function (this: unknown, ...args: T): Promise<R> {
    // Support reentrancy: detect if the wrapper function is already on the
    // call stack by checking if depth > 0. When depth > 1, it means the
    // wrapper was called while already executing (reentrant call), which
    // happens when the wrapped function (fn) calls back into the wrapper.
    // In this case, execute the reentrant call immediately to avoid deadlock.
    // This is safe because the sequential wrapper already ensures only one
    // operation executes at a time per session, and the reentrant call is
    // executing within that same serialized context.
    //
    // For non-reentrant concurrent calls (where the wrapper is not on the
    // call stack), the call is added to the queue and executed sequentially.
    depth++
    try {
      if (depth > 1) {
        // Reentrant call: wrapper is on the call stack
        return fn.apply(this, args)
      }

      return new Promise((resolve, reject) => {
        queue.push({ args, resolve, reject, context: this })
        void processQueue()
      })
    } finally {
      depth--
    }
  }
}
