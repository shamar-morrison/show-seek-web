import { CancelledError } from "@tanstack/react-query"

const BATCH_DELAY_MS = 300
const BATCH_SIZE = 10

type AsyncRequestFn<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => Promise<TResult>

interface QueuedRequest<TArgs extends unknown[], TResult> {
  args: TArgs
  fn: AsyncRequestFn<TArgs, TResult>
  reject: (error: unknown) => void
  resolve: (value: TResult) => void
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

let isProcessing = false
let isProcessingScheduled = false
let queuedRequests: Array<QueuedRequest<unknown[], unknown>> = []

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
        batch.map(async ({ fn, args, resolve, reject }) => {
          try {
            resolve(await fn(...args))
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

export function enqueueRateLimitedRequest<TArgs extends unknown[], TResult>(
  fn: AsyncRequestFn<TArgs, TResult>,
  ...args: TArgs
) {
  return new Promise<TResult>((resolve, reject) => {
    queuedRequests.push({
      args: args as unknown[],
      fn: fn as AsyncRequestFn<unknown[], unknown>,
      reject,
      resolve: resolve as (value: unknown) => void,
    })

    scheduleQueueProcessing()
  })
}

export function createRateLimitedQueryFn<TArgs extends unknown[], TResult>(
  fn: AsyncRequestFn<TArgs, TResult>,
) {
  return (...args: TArgs) => enqueueRateLimitedRequest(fn, ...args)
}

export function clearRateLimitedRequestQueue() {
  const pendingRequests = queuedRequests
  queuedRequests = []

  for (const { reject } of pendingRequests) {
    reject(new CancelledError())
  }
}
