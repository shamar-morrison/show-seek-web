"use client"

import { AuthModal } from "@/components/auth-modal"
import { CollectionMoviesGrid } from "@/components/collection-movies-grid"
import { PremiumModal } from "@/components/premium-modal"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import {
  useCanTrackMoreCollections,
  useCollectionTracking,
  useStartCollectionTracking,
  useStopCollectionTracking,
} from "@/hooks/use-collection-tracking"
import {
  PREMIUM_LOADING_MESSAGE,
  isPremiumStatusPending,
} from "@/lib/premium-gating"
import type { TMDBCollectionDetails } from "@/types/tmdb"
import {
  Loading03Icon,
  PlayIcon,
  StopCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

interface CollectionPageClientProps {
  collection: TMDBCollectionDetails
}

export function CollectionPageClient({
  collection,
}: CollectionPageClientProps) {
  const { loading: authLoading, premiumLoading, premiumStatus } = useAuth()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()
  const {
    tracking,
    isTracked,
    watchedCount,
    totalMovies,
    percentage,
    isLoading,
  } = useCollectionTracking(collection.id)
  const {
    canTrackMore,
    maxFreeCollections,
    isLoading: isLimitLoading,
  } = useCanTrackMoreCollections()
  const startTrackingMutation = useStartCollectionTracking()
  const stopTrackingMutation = useStopCollectionTracking()
  const [showStopTrackingDialog, setShowStopTrackingDialog] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const collectionMovies = useMemo(
    () => collection.parts ?? [],
    [collection.parts],
  )

  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const isTrackingStateLoading = authLoading || isLoading
  const isActionLoading =
    isTrackingStateLoading ||
    isLimitLoading ||
    startTrackingMutation.isPending ||
    stopTrackingMutation.isPending

  const handleStartTracking = useCallback(() => {
    requireAuth(async () => {
      if (isTracked || isPremiumCheckPending) {
        return
      }

      if (!canTrackMore) {
        setShowPremiumModal(true)
        return
      }

      try {
        await startTrackingMutation.mutateAsync({
          collectionId: collection.id,
          name: collection.name,
          totalMovies: collectionMovies.length,
          collectionMovieIds: collectionMovies.map((movie) => movie.id),
        })
        toast.success("Collection tracking started")
      } catch (error) {
        console.error("Failed to start collection tracking:", error)
        toast.error("Failed to start collection tracking")
      }
    }, "Sign in to track collection progress")
  }, [
    canTrackMore,
    collection.id,
    collection.name,
    isPremiumCheckPending,
    isTracked,
    requireAuth,
    collectionMovies,
    startTrackingMutation,
  ])

  const handleStopTracking = useCallback(async () => {
    try {
      await stopTrackingMutation.mutateAsync({
        collectionId: collection.id,
      })
      setShowStopTrackingDialog(false)
      toast.success("Collection tracking stopped")
    } catch (error) {
      console.error("Failed to stop collection tracking:", error)
      toast.error("Failed to stop collection tracking")
    }
  }, [collection.id, collection.name, stopTrackingMutation])

  const backdropUrl = collection.backdrop_path
    ? `https://image.tmdb.org/t/p/original${collection.backdrop_path}`
    : null

  return (
    <>
      <main className="min-h-screen bg-black pb-20">
        <section className="relative w-full overflow-hidden">
          {backdropUrl && (
            <div className="absolute inset-0">
              <Image
                src={backdropUrl}
                alt={collection.name}
                fill
                priority
                sizes="100vw"
                className="object-cover object-center opacity-60"
              />
            </div>
          )}

          <div className="absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-black/70 to-transparent" />
          <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 z-10 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

          <div className="relative z-20 pb-16 pt-64">
            <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
                <div className="flex flex-1 flex-col gap-4 text-center lg:text-left">
                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    {collection.name}
                  </h1>

                  {collection.overview && (
                    <p className="max-w-3xl text-center text-base leading-relaxed text-gray-300 lg:text-left">
                      {collection.overview}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                      {collectionMovies.length}{" "}
                      {collectionMovies.length === 1 ? "Movie" : "Movies"}
                    </div>
                    {isTrackingStateLoading ? (
                      <Skeleton className="h-10 w-36 rounded-full" />
                    ) : isTracked ? (
                      <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm font-medium text-green-300 backdrop-blur-sm">
                        {watchedCount}/
                        {Math.max(totalMovies, collectionMovies.length)} watched
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                    {isTrackingStateLoading ? (
                      <div className="space-y-4" aria-hidden="true">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-11 w-40 rounded-xl" />
                      </div>
                    ) : isTracked ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-gray-300">
                              Watched {watchedCount} of{" "}
                              {Math.max(totalMovies, collectionMovies.length)}
                            </span>
                            <span className="font-semibold text-primary">
                              {percentage}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="lg"
                          className="border-red-500/50 bg-red-500/10 font-semibold text-red-300 hover:border-red-500 hover:bg-red-500/20 hover:text-red-200"
                          onClick={() => setShowStopTrackingDialog(true)}
                          disabled={isActionLoading}
                        >
                          {stopTrackingMutation.isPending ? (
                            <HugeiconsIcon
                              icon={Loading03Icon}
                              className="size-5 animate-spin"
                            />
                          ) : (
                            <HugeiconsIcon
                              icon={StopCircleIcon}
                              className="size-5"
                            />
                          )}
                          Stop Tracking
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button
                          size="lg"
                          className="font-semibold"
                          onClick={handleStartTracking}
                          disabled={isActionLoading || isPremiumCheckPending}
                        >
                          {startTrackingMutation.isPending ? (
                            <HugeiconsIcon
                              icon={Loading03Icon}
                              className="size-5 animate-spin"
                            />
                          ) : (
                            <HugeiconsIcon icon={PlayIcon} className="size-5" />
                          )}
                          Start Tracking
                        </Button>

                        {isPremiumCheckPending ? (
                          <p className="text-sm text-white/60">
                            {PREMIUM_LOADING_MESSAGE}
                          </p>
                        ) : !canTrackMore ? (
                          <p className="text-sm text-white/60">
                            Free users can track up to {maxFreeCollections}{" "}
                            collections. Upgrade to Premium for unlimited
                            tracking.
                          </p>
                        ) : (
                          <p className="text-sm text-white/60">
                            Track your progress across this collection and keep
                            watched badges in sync as you mark movies watched.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
          <h2 className="mb-6 text-2xl font-bold text-white">Movies</h2>
          <CollectionMoviesGrid
            movies={collectionMovies}
            collectionId={collection.id}
            isTracked={isTracked}
            watchedMovieIds={tracking?.watchedMovieIds ?? []}
          />
        </div>
      </main>

      <AlertDialog
        open={showStopTrackingDialog}
        onOpenChange={setShowStopTrackingDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Stop tracking your progress for {collection.name}? Your watch
              history will remain, but this collection will no longer show
              progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopTrackingMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStopTracking}
              disabled={stopTrackingMutation.isPending}
              variant="destructive"
            >
              {stopTrackingMutation.isPending ? "Stopping..." : "Stop Tracking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />

      {modalVisible && (
        <AuthModal
          isOpen={modalVisible}
          onClose={closeModal}
          message={modalMessage}
        />
      )}
    </>
  )
}
