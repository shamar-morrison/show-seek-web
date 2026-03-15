"use client"

import { toast } from "sonner"

interface ActionableToastConfig {
  action: {
    errorMessage: string
    label: string
    logMessage?: string
    onClick: () => void | Promise<void>
  }
  duration?: number
}

export function showActionableSuccessToast(
  message: string,
  config: ActionableToastConfig,
) {
  let isRunning = false

  return toast.success(message, {
    duration: config.duration ?? 6000,
    action: {
      label: config.action.label,
      onClick: () => {
        if (isRunning) {
          return
        }

        isRunning = true
        void Promise.resolve(config.action.onClick())
          .catch((error) => {
            console.error(config.action.logMessage ?? "Toast action failed:", error)
            toast.error(config.action.errorMessage)
          })
          .finally(() => {
            isRunning = false
          })
      },
    },
  })
}
