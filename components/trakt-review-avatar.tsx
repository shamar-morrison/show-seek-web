"use client"

import { cn } from "@/lib/utils"
import { UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface TraktReviewAvatarProps {
  /** Username used for the image alt text */
  username: string
  /** Avatar URL from Trakt (often truthy but unloadable when unset) */
  avatarUrl?: string | null
  /** Sizing classes for the circular container (e.g. "h-10 w-10") */
  className?: string
  /** Sizing classes for the placeholder icon */
  iconClassName?: string
}

/**
 * TraktReviewAvatar Component
 * Reviewer avatar with a person-silhouette placeholder fallback.
 * Trakt commonly returns a truthy avatar URL that fails to load for users
 * without avatars, so a broken URL swaps to the placeholder via onError
 * instead of rendering a broken-image glyph.
 */
export function TraktReviewAvatar({
  username,
  avatarUrl,
  className,
  iconClassName = "size-5",
}: TraktReviewAvatarProps) {
  const [failed, setFailed] = useState(false)
  const [prevUrl, setPrevUrl] = useState(avatarUrl)
  // Render-phase adjustment: a new URL gets a fresh load attempt.
  if (prevUrl !== avatarUrl) {
    setPrevUrl(avatarUrl)
    setFailed(false)
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-gray-800",
        className,
      )}
    >
      {avatarUrl && !failed ? (
        <img
          key={avatarUrl}
          src={avatarUrl}
          alt={username}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`${username} placeholder avatar`}
          className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400"
        >
          <HugeiconsIcon icon={UserIcon} className={iconClassName} />
        </div>
      )}
    </div>
  )
}
