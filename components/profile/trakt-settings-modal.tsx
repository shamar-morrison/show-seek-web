"use client"

import { PremiumModal } from "@/components/premium-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { useTrakt } from "@/context/trakt-context"
import {
  PREMIUM_LOADING_MESSAGE,
  isPremiumStatusPending,
  shouldEnforcePremiumLock,
} from "@/lib/premium-gating"
import { cn } from "@/lib/utils"
import { TraktRequestError } from "@/services/trakt-service"
import type {
  SyncErrorCategory,
  SyncStatus,
  TraktSyncItems,
} from "@/types/trakt"
import {
  Alert02Icon,
  DatabaseSyncIcon,
  Loading03Icon,
  MagicWand02Icon,
  RefreshIcon,
  Tick02Icon,
  Unlink02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { formatDistanceToNow } from "date-fns"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface TraktSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SYNC_COUNT_LABELS: Array<{
  key: keyof TraktSyncItems
  label: string
}> = [
  { key: "movies", label: "Movies" },
  { key: "shows", label: "Shows" },
  { key: "episodes", label: "Episodes" },
  { key: "ratings", label: "Ratings" },
  { key: "lists", label: "Lists" },
  { key: "favorites", label: "Favorites" },
  { key: "watchlistItems", label: "Watchlist" },
]

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never"

  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return "Unknown"

  return formatDistanceToNow(parsed, { addSuffix: true })
}

function formatRetryTime(value: string | undefined): string | null {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getTime() <= Date.now()) return "now"

  return formatDistanceToNow(parsed, { addSuffix: true })
}

function getSyncStatusLabel(status: SyncStatus | null): string {
  if (!status) return "Not connected"

  switch (status.status) {
    case "queued":
      return "Queued"
    case "in_progress":
      return "Importing"
    case "retrying":
      return "Retrying"
    case "completed":
      return "Imported"
    case "failed":
      return "Needs attention"
    default:
      return status.connected ? "Connected" : "Not connected"
  }
}

function getErrorTitle(category?: SyncErrorCategory): string {
  switch (category) {
    case "locked_account":
      return "Trakt account is locked"
    case "storage_limit":
      return "ShowSeek storage limit reached"
    case "rate_limited":
      return "Trakt is rate limiting imports"
    case "upstream_blocked":
      return "Trakt blocked this request"
    case "upstream_unavailable":
      return "Trakt is unavailable"
    case "auth_invalid":
      return "Trakt connection expired"
    default:
      return "Trakt import failed"
  }
}

function getErrorMessage(status: SyncStatus): string {
  const fallback =
    status.errorCategory === "auth_invalid"
      ? "Disconnect and reconnect Trakt, then run the import again."
      : "Try again later. If this keeps happening, disconnect and reconnect Trakt."

  return status.errorMessage || status.errors?.[0] || fallback
}

function showRequestErrorToast(
  error: unknown,
  fallbackMessage: string,
  rateLimitField: "nextAllowedSyncAt" | "nextAllowedEnrichAt",
) {
  if (error instanceof TraktRequestError) {
    const nextAllowedAt =
      rateLimitField === "nextAllowedSyncAt"
        ? error.nextAllowedSyncAt
        : error.nextAllowedEnrichAt
    const retryTime = formatRetryTime(nextAllowedAt)
    toast.error(
      retryTime ? `${error.message} Try again ${retryTime}.` : error.message,
    )
    return
  }

  toast.error(fallbackMessage)
}

function StatusBadge({
  isConnected,
  isSyncing,
  status,
}: {
  isConnected: boolean
  isSyncing: boolean
  status: SyncStatus | null
}) {
  const isError = status?.status === "failed"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
        isError
          ? "bg-red-500/15 text-red-300"
          : isConnected
            ? "bg-green-500/15 text-green-300"
            : "bg-white/10 text-white/60",
      )}
    >
      {isSyncing ? (
        <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
      ) : isError ? (
        <HugeiconsIcon icon={Alert02Icon} className="size-3" />
      ) : isConnected ? (
        <HugeiconsIcon icon={Tick02Icon} className="size-3" />
      ) : null}
      {getSyncStatusLabel(status)}
    </span>
  )
}

function SyncCounts({ itemsSynced }: { itemsSynced?: TraktSyncItems }) {
  const hasCounts =
    itemsSynced &&
    SYNC_COUNT_LABELS.some(({ key }) => Number(itemsSynced[key] ?? 0) > 0)

  if (!hasCounts) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
        No changes were imported in the last completed Trakt sync.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SYNC_COUNT_LABELS.map(({ key, label }) => (
        <div
          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
          key={key}
        >
          <div className="text-lg font-semibold text-white">
            {itemsSynced[key] ?? 0}
          </div>
          <div className="text-xs text-white/50">{label}</div>
        </div>
      ))}
    </div>
  )
}

function SyncErrorBanner({ status }: { status: SyncStatus | null }) {
  if (status?.status !== "failed") return null

  const retryTime = formatRetryTime(status.nextAllowedSyncAt)

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex gap-3">
        <HugeiconsIcon
          icon={Alert02Icon}
          className="mt-0.5 size-5 shrink-0 text-red-300"
        />
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-red-200">
            {getErrorTitle(status.errorCategory)}
          </h3>
          <p className="mt-1 text-sm text-red-100/80">
            {getErrorMessage(status)}
          </p>
          {retryTime && (
            <p className="mt-2 text-xs text-red-100/60">
              Next import is available {retryTime}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function TraktSettingsModal({
  open,
  onOpenChange,
}: TraktSettingsModalProps) {
  const {
    isConnected,
    isSyncing,
    isEnriching,
    lastSyncedAt,
    lastEnrichedAt,
    syncStatus,
    isLoading,
    connectTrakt,
    disconnectTrakt,
    syncNow,
    checkSyncStatus,
    enrichData,
  } = useTrakt()
  const { premiumLoading, premiumStatus } = useAuth()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false)
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false)

  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const shouldLockPremiumFeatures = shouldEnforcePremiumLock({
    premiumLoading,
    premiumStatus,
  })
  const isBusy = isLoading || isConnecting || isDisconnecting
  const isImportUnavailable = isBusy || isSyncing || !isConnected
  const isEnrichUnavailable =
    isBusy || isEnriching || isSyncing || !lastSyncedAt

  const retryText = useMemo(() => {
    if (syncStatus?.status !== "retrying") return null

    const pieces: string[] = []
    if (syncStatus.attempt) {
      pieces.push(
        `Attempt ${syncStatus.attempt} of ${syncStatus.maxAttempts ?? 5}`,
      )
    }

    const nextRetry = formatRetryTime(syncStatus.nextRetryAt)
    if (nextRetry) {
      pieces.push(`next retry ${nextRetry}`)
    }

    return pieces.join(", ")
  }, [syncStatus])

  async function handleConnect() {
    if (isPremiumCheckPending) {
      toast.info(`${PREMIUM_LOADING_MESSAGE} Please try again in a moment.`)
      return
    }

    if (shouldLockPremiumFeatures) {
      setIsPremiumModalOpen(true)
      return
    }

    try {
      setIsConnecting(true)
      await connectTrakt()
      toast.success("Trakt connected.")
    } catch (error) {
      showRequestErrorToast(
        error,
        "Failed to connect Trakt.",
        "nextAllowedSyncAt",
      )
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleSync() {
    try {
      await syncNow()
      toast.success("Trakt import started.")
    } catch (error) {
      showRequestErrorToast(
        error,
        "Failed to import Trakt data.",
        "nextAllowedSyncAt",
      )
    }
  }

  async function handleEnrich() {
    try {
      await enrichData()
      toast.success("Trakt enrichment started.")
    } catch (error) {
      showRequestErrorToast(
        error,
        "Failed to enrich imported Trakt data.",
        "nextAllowedEnrichAt",
      )
    }
  }

  async function handleCheckStatus() {
    try {
      await checkSyncStatus()
      toast.success("Trakt status updated.")
    } catch (error) {
      showRequestErrorToast(
        error,
        "Failed to check Trakt status.",
        "nextAllowedSyncAt",
      )
    }
  }

  async function handleDisconnect() {
    try {
      setIsDisconnecting(true)
      await disconnectTrakt()
      setIsDisconnectDialogOpen(false)
      toast.success("Trakt disconnected.")
    } catch {
      toast.error("Failed to disconnect Trakt.")
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto border-white/10 bg-[#0b0b0d] p-0 sm:max-w-2xl">
          <div className="space-y-6 p-6">
            <DialogHeader className="pr-8">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white">
                  <img
                    src="/trakt-logo.svg"
                    alt=""
                    className="size-7"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-lg text-white">
                      Trakt Integration
                    </DialogTitle>
                    <StatusBadge
                      isConnected={isConnected}
                      isSyncing={isSyncing}
                      status={syncStatus}
                    />
                  </div>
                  <DialogDescription className="mt-2 text-white/60">
                    Import Trakt watched history, ratings, watchlist, favorites,
                    and custom lists into ShowSeek.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <SyncErrorBanner status={syncStatus} />

            {isLoading ? (
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Checking Trakt status...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs text-white/50">Last import</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {formatRelativeTime(lastSyncedAt)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs text-white/50">Last enrichment</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {formatRelativeTime(lastEnrichedAt)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs text-white/50">Mode</div>
                    <div className="mt-1 text-sm font-medium text-white capitalize">
                      {syncStatus?.summaryMode ?? "Bootstrap"}
                    </div>
                  </div>
                </div>

                {retryText && (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Trakt import is retrying: {retryText}.
                  </div>
                )}

                {!isConnected ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="text-sm font-medium text-white">
                      Connect your Trakt account
                    </h3>
                    <p className="mt-1 text-sm text-white/60">
                      Trakt sync is available for Premium members. Your watched
                      movies and shows import into the existing Already Watched
                      list.
                    </p>
                    <Button
                      className="mt-4 bg-[#ed1c24] text-white hover:bg-[#ed1c24]/80"
                      disabled={isConnecting || isPremiumCheckPending}
                      onClick={handleConnect}
                    >
                      {isConnecting ? (
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <img
                          src="/trakt-logo.svg"
                          alt=""
                          className="size-4"
                          aria-hidden="true"
                        />
                      )}
                      Connect Trakt
                    </Button>
                  </div>
                ) : (
                  <>
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-white">
                            Last imported items
                          </h3>
                          <p className="mt-1 text-xs text-white/50">
                            Watched movies and shows are stored in Already
                            Watched.
                          </p>
                        </div>
                      </div>
                      <SyncCounts itemsSynced={syncStatus?.itemsSynced} />
                    </section>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="sm:flex-1"
                        disabled={isImportUnavailable}
                        onClick={handleSync}
                      >
                        {isSyncing ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            className="size-4 animate-spin"
                          />
                        ) : (
                          <HugeiconsIcon icon={DatabaseSyncIcon} />
                        )}
                        {lastSyncedAt ? "Mirror now" : "Import from Trakt"}
                      </Button>
                      <Button
                        className="sm:flex-1"
                        disabled={isEnrichUnavailable}
                        onClick={handleEnrich}
                        variant="outline"
                      >
                        {isEnriching ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            className="size-4 animate-spin"
                          />
                        ) : (
                          <HugeiconsIcon icon={MagicWand02Icon} />
                        )}
                        Enrich data
                      </Button>
                      <Button
                        disabled={isBusy}
                        onClick={() => setIsDisconnectDialogOpen(true)}
                        variant="destructive"
                      >
                        <HugeiconsIcon icon={Unlink02Icon} />
                        Disconnect
                      </Button>
                    </div>

                    <Button
                      disabled={isBusy || isSyncing}
                      onClick={() => void handleCheckStatus()}
                      size="sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon icon={RefreshIcon} />
                      Check for updates
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDisconnectDialogOpen}
        onOpenChange={setIsDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Trakt?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops future Trakt imports. Existing ShowSeek lists, ratings,
              and episode progress stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDisconnecting}
              onClick={() => void handleDisconnect()}
              variant="destructive"
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PremiumModal
        open={isPremiumModalOpen}
        onOpenChange={setIsPremiumModalOpen}
      />
    </>
  )
}
