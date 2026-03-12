const DEFAULT_CONCURRENCY = 5

export async function mapWithConcurrencyLimit<T, TResult>(
  items: readonly T[],
  worker: (item: T) => Promise<TResult>,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<TResult[]> {
  if (items.length === 0) {
    return []
  }

  const results = new Array<TResult>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(items.length, Math.max(1, concurrency))

  async function run(): Promise<void> {
    if (nextIndex >= items.length) {
      return
    }

    const currentIndex = nextIndex
    nextIndex += 1
    results[currentIndex] = await worker(items[currentIndex] as T)
    await run()
  }

  await Promise.all(Array.from({ length: workerCount }, () => run()))

  return results
}
