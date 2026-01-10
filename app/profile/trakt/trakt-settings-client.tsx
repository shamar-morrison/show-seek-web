"use client"

import { ActionButton } from "@/components/profile/action-button"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase/config"
import {
  ArrowLeft02Icon,
  Loading03Icon,
  RefreshIcon,
  SparklesIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { doc, onSnapshot, Timestamp } from "firebase/firestore"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface SyncResult {
  movies: number
  shows: number
  episodes: number
  ratings: number
  lists: number
  favorites: number
  watchlist: number
}

interface TraktStatus {
  connected: boolean
  lastSyncAt?: number
  lastSyncResult?: SyncResult
}

export function TraktSettingsClient() {
  const { user } = useAuth()
  const [status, setStatus] = useState<TraktStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [enriching, setEnriching] = useState(false)
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
            lastSyncResult: data.traktLastSyncResult,
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
      const totalItems =
        result.movies +
        result.shows +
        result.episodes +
        result.ratings +
        result.watchlist +
        result.favorites +
        result.lists
      toast.success(`Synced ${totalItems} items from Trakt`)
    } catch (error) {
      console.error("Trakt sync error:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to sync with Trakt",
      )
    } finally {
      setSyncing(false)
    }
  }

  async function handleEnrich() {
    setEnriching(true)
    try {
      const response = await fetch("/api/trakt/enrich", { method: "POST" })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Enrichment failed")
      }

      const result = await response.json()
      toast.success(`Added posters to ${result.enrichedCount} items`)
    } catch (error) {
      console.error("Trakt enrich error:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to add posters",
      )
    } finally {
      setEnriching(false)
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
    const diffMs = Date.now() - timestamp
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "in less than a minute"
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
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

      {status?.connected ? (
        <>
          {/* Last Synced */}
          {status.lastSyncAt && (
            <p className="mb-4 text-center text-sm text-white/60">
              Last synced: {formatLastSync(status.lastSyncAt)}
            </p>
          )}

          {/* Synced Items Breakdown */}
          {status.lastSyncResult && (
            <div className="mb-6 rounded-xl bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Synced Items
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatBox value={status.lastSyncResult.movies} label="Movies" />
                <StatBox value={status.lastSyncResult.shows} label="Shows" />
                <StatBox
                  value={status.lastSyncResult.episodes}
                  label="Episodes"
                />
                <StatBox
                  value={status.lastSyncResult.ratings}
                  label="Ratings"
                />
                <StatBox value={status.lastSyncResult.lists} label="Lists" />
                <StatBox
                  value={status.lastSyncResult.favorites}
                  label="Favorites"
                />
              </div>
              <div className="mt-3">
                <StatBox
                  value={status.lastSyncResult.watchlist}
                  label="Watchlist"
                  fullWidth
                />
              </div>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={syncing ? "size-5 animate-spin" : "size-5"}
            />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          {/* Enrich Section */}
          <div
            className={`mb-6 rounded-xl bg-amber-500/10 p-4 ${!status.lastSyncResult ? "opacity-50" : ""}`}
          >
            <div className="mb-3 flex items-start gap-3">
              <HugeiconsIcon
                icon={SparklesIcon}
                className="size-5 text-amber-400"
              />
              <div>
                <h3 className="font-medium text-amber-400">
                  Add Posters & Ratings
                </h3>
                <p className="text-sm text-white/60">
                  {status.lastSyncResult
                    ? "Enhance your library with movie posters and ratings from TMDB."
                    : "Sync your library first to enable enrichment."}
                </p>
              </div>
            </div>
            <button
              onClick={handleEnrich}
              disabled={enriching || !status.lastSyncResult}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HugeiconsIcon
                icon={SparklesIcon}
                className={enriching ? "size-5 animate-spin" : "size-5"}
              />
              {enriching ? "Enriching..." : "Enrich My Library"}
            </button>
          </div>

          {/* Disconnect */}
          <div className="rounded-xl bg-white/5">
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
          </div>
        </>
      ) : (
        <>
          {/* Not Connected State */}
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
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/60">
              Not Connected
            </span>
          </div>

          <button
            onClick={handleConnect}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ED1C24] py-4 font-medium text-white transition-opacity hover:opacity-90"
          >
            Connect to Trakt
          </button>

          <p className="mt-6 text-center text-xs text-white/40">
            Connecting to Trakt will sync your movie and TV ratings, watchlist,
            and watch history.
          </p>
        </>
      )}
    </div>
  )
}

function StatBox({
  value,
  label,
  fullWidth = false,
}: {
  value: number
  label: string
  fullWidth?: boolean
}) {
  return (
    <div
      className={`rounded-lg bg-white/5 p-3 text-center ${fullWidth ? "col-span-3" : ""}`}
    >
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  )
}
