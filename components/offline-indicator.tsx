"use client"

import { Button } from "@/components/ui/button"
import { WifiDisconnected01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useState } from "react"

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine)

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!isOffline) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-100 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <HugeiconsIcon
            icon={WifiDisconnected01Icon}
            className="size-8 text-destructive"
          />
        </div>

        <div>
          <h1 className="text-xl font-semibold text-foreground">
            You&apos;re Offline
          </h1>
          <p className="mt-2 text-muted-foreground">
            No internet connection. Please check your network and try again.
          </p>
        </div>

        <Button onClick={() => window.location.reload()} className="mt-2">
          Try Again
        </Button>
      </div>
    </div>
  )
}
