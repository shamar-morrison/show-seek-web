"use client"

import { SharePostModal } from "@/components/share-post-modal"
import { Button } from "@/components/ui/button"
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/ui/action-menu"
import { buildShareCaption, type SharePostMedia } from "@/lib/share-post"
import { Image01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

interface ShareMenuButtonProps {
  /** Media to share (title, artwork, year, genres, rating) */
  media: SharePostMedia
  /**
   * Extra menu items rendered after the built-in entries.
   * The menu is extensible: future actions slot in here.
   */
  extraItems?: ActionMenuItem[]
}

/**
 * Hero-style "Share" dropdown button for media detail screens.
 * Opens an extensible menu (currently: Create Share Post).
 */
export function ShareMenuButton({ media, extraItems = [] }: ShareMenuButtonProps) {
  const [isSharePostOpen, setIsSharePostOpen] = useState(false)

  const caption = useMemo(
    () =>
      buildShareCaption({
        title: media.title,
        releaseYear: media.releaseYear,
        userRating: media.userRating,
      }),
    [media.title, media.releaseYear, media.userRating],
  )

  const items = useMemo<ActionMenuItem[]>(
    () => [
      {
        type: "action",
        key: "create-share-post",
        label: "Create Share Post",
        icon: Image01Icon,
        onClick: () => setIsSharePostOpen(true),
      },
      ...extraItems,
    ],
    [extraItems],
  )

  return (
    <>
      <ActionMenu
        items={items}
        align="start"
        trigger={
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="border-white/20 bg-white/5 px-3 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
            aria-label="More options"
            data-testid="share-menu-button"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} className="size-5" />
          </Button>
        }
      />
      <SharePostModal
        isOpen={isSharePostOpen}
        onClose={() => setIsSharePostOpen(false)}
        media={media}
        caption={caption}
      />
    </>
  )
}
