"use client"

import { PremiumModal } from "@/components/premium-modal"
import { ActionButton } from "@/components/profile/action-button"
import { ExportDataModal } from "@/components/profile/export-data-modal"
import { HomeScreenCustomizer } from "@/components/profile/HomeScreenCustomizer"
import { ImdbImportModal } from "@/components/profile/imdb-import-modal"
import { PreferenceToggle } from "@/components/profile/preference-toggle"
import { TraktSettingsModal } from "@/components/profile/trakt-settings-modal"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { useTrakt } from "@/context/trakt-context"
import { usePreferences } from "@/hooks/use-preferences"
import {
  PREMIUM_LOADING_MESSAGE,
  isPremiumStatusPending,
  shouldEnforcePremiumLock,
} from "@/lib/premium-gating"
import {
  createPremiumTelemetryPayload,
  trackPremiumEvent,
} from "@/lib/premium-telemetry"
import { captureException } from "@/lib/utils"
import {
  ArrowRight01Icon,
  FileImportIcon,
  FileExportIcon,
  Home01Icon,
  Loading03Icon,
  Logout01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { toast } from "sonner"

export function ProfilePageClient() {
  const { user, loading, premiumLoading, premiumStatus, signOut } = useAuth()
  const {
    isConnected: isTraktConnected,
    isLoading: isTraktLoading,
    isSyncing: isTraktSyncing,
  } = useTrakt()
  const {
    preferences,
    isLoading: prefsLoading,
    updatePreference,
  } = usePreferences()

  const [showExportModal, setShowExportModal] = useState(false)
  const [showHomeCustomizer, setShowHomeCustomizer] = useState(false)
  const [showImdbImportModal, setShowImdbImportModal] = useState(false)
  const [showTraktModal, setShowTraktModal] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const shouldLockPremiumFeatures = shouldEnforcePremiumLock({
    premiumLoading,
    premiumStatus,
  })
  const isPremiumMember = premiumStatus === "premium"
  const canAccessPremiumFeatures = !shouldLockPremiumFeatures

  if (loading || prefsLoading || !user) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="h-4 w-48 rounded bg-white/10" />
          </div>
        </div>
        <div className="h-64 rounded-lg bg-white/10" />
      </div>
    )
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      await signOut()
    } catch (error) {
      captureException(error)
      toast.error("Failed to sign out. Please try again.")
      setIsSigningOut(false)
    }
  }

  function handleExportData() {
    if (isPremiumCheckPending) {
      trackPremiumEvent(
        "premium_gate_blocked_while_loading",
        createPremiumTelemetryPayload({
          uid: user?.uid,
          premiumStatusBefore: premiumStatus,
          premiumStatusAfter: premiumStatus,
        }),
      )
      toast.info(`${PREMIUM_LOADING_MESSAGE} Please try again in a moment.`)
      return
    }

    if (shouldLockPremiumFeatures) {
      setShowPremiumModal(true)
      return
    }
    setShowExportModal(true)
  }

  function handleImdbImport() {
    if (isPremiumCheckPending) {
      trackPremiumEvent(
        "premium_gate_blocked_while_loading",
        createPremiumTelemetryPayload({
          uid: user?.uid,
          premiumStatusBefore: premiumStatus,
          premiumStatusAfter: premiumStatus,
        }),
      )
      toast.info(`${PREMIUM_LOADING_MESSAGE} Please try again in a moment.`)
      return
    }

    if (shouldLockPremiumFeatures) {
      setShowPremiumModal(true)
      return
    }

    setShowImdbImportModal(true)
  }

  return (
    <>
      {/* Profile Header */}
      <section className="mb-8">
        <div className="flex items-center gap-4">
          <Avatar
            src={user?.photoURL}
            alt={user?.displayName || "User"}
            fallback={user?.displayName || user?.email || "User"}
            size="lg"
            isPremium={isPremiumMember}
          />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">
              {user?.displayName || "User"}
            </h1>
            <p className="text-sm text-white/60">{user?.email}</p>
          </div>
          {isPremiumMember ? (
            <Badge variant="premium">Premium Member</Badge>
          ) : isPremiumCheckPending ? (
            <span className="text-xs text-muted-foreground">
              {PREMIUM_LOADING_MESSAGE}
            </span>
          ) : (
            <button
              onClick={() => setShowPremiumModal(true)}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Upgrade to Premium
            </button>
          )}
        </div>
      </section>

      {/* Preferences Section */}
      <section className="mb-8">
        <h2 className="mb-2 px-4 text-sm font-medium text-white/40 uppercase tracking-wide">
          Preferences
        </h2>
        {isPremiumCheckPending && (
          <p className="mb-3 px-4 text-xs text-muted-foreground">
            {PREMIUM_LOADING_MESSAGE}
          </p>
        )}
        <div className="rounded-xl bg-white/5">
          <PreferenceToggle
            label="Auto-add to Watching"
            description="Automatically add series to your Watching list when you mark an episode as watched"
            checked={preferences.autoAddToWatching}
            onChange={(value) => updatePreference("autoAddToWatching", value)}
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Auto-add to Already Watched"
            description="Automatically add movies to your Already Watched list when you rate or mark them as watched"
            checked={preferences.autoAddToAlreadyWatched}
            onChange={(value) =>
              updatePreference("autoAddToAlreadyWatched", value)
            }
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Auto-remove from Should Watch"
            description="Automatically remove movies from your Should Watch list when you rate or mark them as watched"
            checked={preferences.autoRemoveFromShouldWatch}
            onChange={(value) =>
              updatePreference("autoRemoveFromShouldWatch", value)
            }
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Quick Mark as Watched"
            description="Skip the date selection modal and use the current time when marking movies as watched"
            checked={preferences.quickMarkAsWatched}
            onChange={(value) => updatePreference("quickMarkAsWatched", value)}
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Mark previous episodes"
            description="Automatically mark earlier episodes in a season as watched"
            checked={preferences.markPreviousEpisodesWatched}
            onChange={(value) =>
              updatePreference("markPreviousEpisodesWatched", value)
            }
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Show list indicators"
            description="Display a bookmark badge on cards when an item is in any of your lists"
            checked={preferences.showListIndicators}
            onChange={(value) => updatePreference("showListIndicators", value)}
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Use original titles"
            description="Show movie and TV titles in their original language when available."
            checked={preferences.showOriginalTitles}
            onChange={(value) => updatePreference("showOriginalTitles", value)}
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Hide watched content"
            description="Remove watched movies and shows from search and discovery lists"
            checked={preferences.hideWatchedContent}
            onChange={(value) => updatePreference("hideWatchedContent", value)}
            premiumRequired
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Hide unreleased content"
            description="Filter out movies and TV shows that haven't aired yet"
            checked={preferences.hideUnreleasedContent}
            onChange={(value) =>
              updatePreference("hideUnreleasedContent", value)
            }
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Blur movie and TV plot"
            description="Hide plot summaries by default to avoid spoilers. Hover to reveal."
            checked={preferences.blurPlotSpoilers}
            onChange={(value) => updatePreference("blurPlotSpoilers", value)}
            premiumRequired
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Show media preview on hover"
            description="Display a preview card with details when hovering over movies and TV shows (desktop only)"
            checked={preferences.showMediaPreviewCards}
            onChange={(value) =>
              updatePreference("showMediaPreviewCards", value)
            }
            isPremium={canAccessPremiumFeatures}
          />
        </div>
      </section>

      {/* Home Screen Section */}
      <section className="mb-8">
        <h2 className="mb-2 px-4 text-sm font-medium text-white/40 uppercase tracking-wide">
          Home Screen
        </h2>
        <div className="rounded-xl bg-white/5">
          <ActionButton
            icon={Home01Icon}
            label="Customize Home Screen"
            onClick={() => setShowHomeCustomizer(true)}
          />
        </div>
      </section>

      {/* Integrations Section */}
      <section className="mb-8">
        <h2 className="mb-2 px-4 text-sm font-medium text-white/40 uppercase tracking-wide">
          Integrations
        </h2>
        <div className="rounded-xl bg-white/5">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5"
            onClick={() => setShowTraktModal(true)}
            type="button"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-white">
              <img
                src="/trakt-logo.svg"
                alt=""
                aria-hidden="true"
                className="size-5"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white">
                Trakt Integration
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/50">
                Import watched history, lists, ratings, and episode progress
              </span>
            </div>
            {isTraktLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-3 animate-spin"
                />
                Checking
              </span>
            ) : isTraktConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                {isTraktSyncing ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-3 animate-spin"
                  />
                ) : (
                  <HugeiconsIcon icon={Tick02Icon} className="size-3" />
                )}
                {isTraktSyncing ? "Syncing" : "Connected"}
              </span>
            ) : null}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-5 text-white/40"
            />
          </button>
          <div className="mx-4 border-t border-white/10" />
          <ActionButton
            icon={FileImportIcon}
            label="IMDb Import"
            onClick={handleImdbImport}
            premiumRequired
            isPremium={canAccessPremiumFeatures}
          />
        </div>
      </section>

      {/* Settings Section */}
      <section>
        <h2 className="mb-2 px-4 text-sm font-medium text-white/40 uppercase tracking-wide">
          Settings
        </h2>
        <div className="rounded-xl bg-white/5">
          <ActionButton
            icon={FileExportIcon}
            label="Export Data"
            onClick={handleExportData}
            premiumRequired
            isPremium={canAccessPremiumFeatures}
          />
          <div className="mx-4 border-t border-white/10" />
          <ActionButton
            icon={Logout01Icon}
            label={isSigningOut ? "Signing out..." : "Sign Out"}
            onClick={handleSignOut}
            disabled={isSigningOut}
            showChevron={false}
          />
        </div>
      </section>

      {/* Modals */}
      <ExportDataModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />

      <HomeScreenCustomizer
        open={showHomeCustomizer}
        onOpenChange={setShowHomeCustomizer}
      />

      <TraktSettingsModal
        open={showTraktModal}
        onOpenChange={setShowTraktModal}
      />

      <ImdbImportModal
        open={showImdbImportModal}
        onOpenChange={setShowImdbImportModal}
        userId={user.uid}
      />
    </>
  )
}
