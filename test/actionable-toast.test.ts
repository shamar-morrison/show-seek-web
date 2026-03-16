import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { beforeEach, describe, expect, it, vi } from "vitest"

const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("showActionableSuccessToast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes synchronous throws through the error path and resets the running guard", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    const onClick = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("sync failure")
      })
      .mockResolvedValueOnce(undefined)

    showActionableSuccessToast("Saved", {
      action: {
        label: "Undo",
        onClick,
        errorMessage: "Failed to undo",
        logMessage: "Undo failed:",
      },
    })

    const toastOptions = toastSuccessMock.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    toastOptions?.action?.onClick()
    await flushPromises()

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Undo failed:",
      expect.any(Error),
    )
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to undo")

    toastOptions?.action?.onClick()
    await flushPromises()

    expect(onClick).toHaveBeenCalledTimes(2)

    consoleErrorSpy.mockRestore()
  })

  it("still handles async rejections", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    const onClick = vi.fn().mockRejectedValue(new Error("async failure"))

    showActionableSuccessToast("Saved", {
      action: {
        label: "Undo",
        onClick,
        errorMessage: "Failed to undo",
        logMessage: "Undo failed:",
      },
    })

    const toastOptions = toastSuccessMock.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    toastOptions?.action?.onClick()
    await flushPromises()

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Undo failed:",
      expect.any(Error),
    )
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to undo")

    consoleErrorSpy.mockRestore()
  })
})
