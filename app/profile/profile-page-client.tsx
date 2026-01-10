"use client"

import { PremiumModal } from "@/components/premium-modal"
import { ActionButton } from "@/components/profile/action-button"
import { ExportDataModal } from "@/components/profile/export-data-modal"
import { HomeScreenCustomizer } from "@/components/profile/HomeScreenCustomizer"
import { PreferenceToggle } from "@/components/profile/preference-toggle"
import { TraktConnect } from "@/components/profile/TraktConnect"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { usePreferences } from "@/hooks/use-preferences"
import { captureException } from "@/lib/utils"
import {
  FileExportIcon,
  Home01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export function ProfilePageClient() {
  const { user, loading, isPremium, signOut } = useAuth()
  const {
    preferences,
    isLoading: prefsLoading,
    updatePreference,
  } = usePreferences()
  const router = useRouter()

  const [showExportModal, setShowExportModal] = useState(false)
  const [showHomeCustomizer, setShowHomeCustomizer] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

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
      router.push("/login")
    } catch (error) {
      captureException(error)
      toast.error("Failed to sign out. Please try again.")
      setIsSigningOut(false)
    }
  }

  function handleExportData() {
    if (!isPremium) {
      setShowPremiumModal(true)
      return
    }
    setShowExportModal(true)
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
            isPremium={isPremium}
          />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">
              {user?.displayName || "User"}
            </h1>
            <p className="text-sm text-white/60">{user?.email}</p>
          </div>
          {isPremium ? (
            <Badge variant="premium">Premium Member</Badge>
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
        <div className="rounded-xl bg-white/5">
          <PreferenceToggle
            label="Auto-add to Watching"
            description="Automatically add series to your Watching list when you mark an episode as watched"
            checked={preferences.autoAddToWatching}
            onChange={(value) => updatePreference("autoAddToWatching", value)}
            isPremium={isPremium}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Auto-add to Already Watched"
            description="Automatically add movies to your Already Watched list when you rate them"
            checked={preferences.autoAddToAlreadyWatched}
            onChange={(value) =>
              updatePreference("autoAddToAlreadyWatched", value)
            }
            isPremium={isPremium}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Show list indicators"
            description="Display a bookmark badge on cards when an item is in any of your lists"
            checked={preferences.showListIndicators}
            onChange={(value) => updatePreference("showListIndicators", value)}
            isPremium={isPremium}
          />
          <div className="mx-4 border-t border-white/10" />
          <PreferenceToggle
            label="Blur movie and TV plot"
            description="Hide plot summaries by default to avoid spoilers. Tap to reveal."
            checked={preferences.blurPlotSpoilers}
            onChange={(value) => updatePreference("blurPlotSpoilers", value)}
            premiumRequired
            isPremium={isPremium}
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
          <TraktConnect />
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
            isPremium={isPremium}
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
    </>
  )
}
