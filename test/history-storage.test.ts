import { afterEach, describe, expect, it, vi } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import {
  createHistoryStorage,
  HISTORY_SCHEMA_VERSION,
} from "@/lib/history/storage"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("history storage connection cleanup", () => {
  it.each(["timeout", "blocked"])(
    "closes a late connection after %s and retains memory fallback",
    async (reason) => {
      vi.useFakeTimers()
      const close = vi.fn()
      const transaction = vi.fn()
      const request = {
        result: { close, transaction },
        onsuccess: undefined as undefined | (() => void),
        onblocked: undefined as undefined | (() => void),
      }
      const open = vi.fn(() => request)
      vi.stubGlobal("indexedDB", { open })
      const storage = createHistoryStorage()
      const record = {
        version: HISTORY_SCHEMA_VERSION,
        updatedAt: 123,
        data: [],
      }
      const pending = storage.put("user:lists", record)
      if (reason === "timeout") await vi.advanceTimersByTimeAsync(2000)
      else request.onblocked!()
      await pending

      request.onsuccess!()
      expect(close).toHaveBeenCalledTimes(1)
      expect(transaction).not.toHaveBeenCalled()
      expect(await storage.get("user:lists")).toEqual(record)
      expect(open).toHaveBeenCalledTimes(1)
    },
  )

  it("persists timely connections across storage instances", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory())
    const record = { version: HISTORY_SCHEMA_VERSION, updatedAt: 123, data: [] }
    await createHistoryStorage().put("user:lists", record)
    expect(await createHistoryStorage().get("user:lists")).toEqual(record)
  })
})
