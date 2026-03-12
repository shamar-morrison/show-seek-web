const BATCH_DELAY_MS = 300
const BATCH_SIZE = 10

interface QueuedRequest<T> {
  fn: () => Promise<T>
  reject: (error: unknown) => void
  resolve: (value: T) => void
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

let isProcessing = false
let isProcessingScheduled = false
let queuedRequests: Array<QueuedRequest<unknown>> = []

function scheduleQueueProcessing() {
  if (
    isProcessing ||
    isProcessingScheduled ||
    queuedRequests.length === 0
  ) {
    return
  }

  isProcessingScheduled = true

  queueMicrotask(() => {
    isProcessingScheduled = false
    void processQueue()
  })
}

async function processQueue() {
  if (isProcessing || queuedRequests.length === 0) {
    return
  }

  isProcessing = true

  try {
    while (queuedRequests.length > 0) {
      const batch = queuedRequests.splice(0, BATCH_SIZE)

      await Promise.all(
        batch.map(async ({ fn, resolve, reject }) => {
          try {
            resolve(await fn())
          } catch (error) {
            reject(error)
          }
        }),
      )

      if (queuedRequests.length > 0) {
        await delay(BATCH_DELAY_MS)
      }
    }
  } finally {
    isProcessing = false

    if (queuedRequests.length > 0) {
      scheduleQueueProcessing()
    }
  }
}

export function enqueueRateLimitedRequest<T>(fn: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    queuedRequests.push({
      fn: fn as () => Promise<unknown>,
      reject,
      resolve: resolve as (value: unknown) => void,
    })

    scheduleQueueProcessing()
  })
}

export function createRateLimitedQueryFn<T>(fn: () => Promise<T>) {
  return () => enqueueRateLimitedRequest(fn)
}

export function clearRateLimitedRequestQueue() {
  const pendingRequests = queuedRequests
  queuedRequests = []

  for (const { reject } of pendingRequests) {
    reject(new Error("Rate-limited request queue cleared"))
  }
}
