"use client"

import { ActionButton } from "@/components/profile/action-button"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase/config"
import {
  ArrowLeft02Icon,
  Loading03Icon,
  RefreshIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { doc, onSnapshot, Timestamp } from "firebase/firestore"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface TraktStatus {
  connected: boolean
  lastSyncAt?: number
}

export function TraktSettingsClient() {
  const { user } = useAuth()
  const [status, setStatus] = useState<TraktStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Real-time listener on user document for Trakt status
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    const userDocRef = doc(db, "users", user.uid)
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          const lastSyncAt = data.traktLastSyncAt
          setStatus({
            connected: data.traktConnected === true,
            lastSyncAt:
              lastSyncAt instanceof Timestamp
                ? lastSyncAt.toMillis()
                : lastSyncAt || undefined,
          })
        } else {
          setStatus({ connected: false })
        }
        setLoading(false)
      },
      (error) => {
        console.error("Error listening to user document:", error)
        setStatus({ connected: false })
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user?.uid])

  function handleConnect() {
    // Open OAuth in a new tab
    window.open("/api/trakt/auth", "_blank")
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const response = await fetch("/api/trakt/sync", { method: "POST" })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Sync failed")
      }

      const result = await response.json()
      toast.success(`Synced ${result.totalItems || 0} items from Trakt`)
    } catch (error) {
      console.error("Trakt sync error:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to sync with Trakt",
      )
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const response = await fetch("/api/trakt/disconnect", { method: "POST" })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Disconnect failed")
      }

      toast.success("Disconnected from Trakt")
    } catch (error) {
      console.error("Trakt disconnect error:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect from Trakt",
      )
    } finally {
      setDisconnecting(false)
    }
  }

  function formatLastSync(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-8 animate-spin text-white/40"
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/profile"
          className="flex size-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-5 text-white" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Trakt</h1>
          <p className="text-sm text-white/60">
            Sync your watch history and ratings
          </p>
        </div>
      </div>

      {/* Trakt Logo and Status */}
      <div className="mb-8 flex flex-col items-center rounded-xl bg-white/5 p-8">
        <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-[#ED1C24]/20">
          <svg className="size-10" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
              fill="#ED1C24"
            />
            <circle cx="12" cy="12" r="4" fill="#ED1C24" />
          </svg>
        </div>

        {status?.connected ? (
          <>
            <span className="mb-2 rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
              Connected
            </span>
            {status.lastSyncAt && (
              <p className="text-sm text-white/40">
                Last synced {formatLastSync(status.lastSyncAt)}
              </p>
            )}
          </>
        ) : (
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/60">
            Not Connected
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="rounded-xl bg-white/5">
        {status?.connected ? (
          <>
            <ActionButton
              icon={RefreshIcon}
              label={syncing ? "Syncing..." : "Sync Now"}
              onClick={handleSync}
              disabled={syncing}
              showChevron={false}
            />
            <div className="mx-4 border-t border-white/10" />
            <ActionButton
              icon={Unlink01Icon}
              label={
                disconnecting ? "Disconnecting..." : "Disconnect from Trakt"
              }
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="danger"
              showChevron={false}
            />
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-4 text-center transition-colors hover:bg-white/5"
          >
            <span className="text-sm font-medium text-[#ED1C24]">
              Connect to Trakt
            </span>
          </button>
        )}
      </div>

      {/* Info */}
      <p className="mt-6 text-center text-xs text-white/40">
        Connecting to Trakt will sync your movie and TV ratings, watchlist, and
        watch history.
      </p>
    </div>
  )
}
