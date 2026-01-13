"use client"

import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { buildImageUrl } from "@/lib/tmdb"
import Link from "next/link"

interface PersonCardProps {
  /** Person's TMDB ID */
  id: number
  /** Person's name */
  name: string
  /** Profile image path from TMDB */
  profilePath: string | null
  /** Secondary text (character name, job title, department, etc.) */
  subtext?: string
  /** Priority loading for above-the-fold images */
  priority?: boolean
  /** If true, card fills container width (for grids). If false, uses fixed width (for horizontal scroll) */
  fullWidth?: boolean
  /** Render function for action button (favorite heart, delete, etc.) */
  renderAction?: (props: {
    personId: number
    personName: string
  }) => React.ReactNode
}

/**
 * PersonCard Component
 * Unified display for cast, crew, and favorite people
 * Shows profile image, name, and secondary text
 * Links to person detail page, supports custom action slot
 */
export function PersonCard({
  id,
  name,
  profilePath,
  subtext,
  priority = false,
  fullWidth = false,
  renderAction,
}: PersonCardProps) {
  const profileUrl = buildImageUrl(profilePath, "w500")

  return (
    <div className="block shrink-0">
      <div
        className={`group relative overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer ${fullWidth ? "w-full" : "w-36 sm:w-40"}`}
      >
        {/* Clickable area for navigation */}
        <Link href={`/person/${id}`} className="block">
          {/* Profile Image */}
          <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
            <ImageWithFallback
              src={profileUrl}
              alt={name}
              fallbackText="No Photo"
              sizes={
                fullWidth
                  ? "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 14vw"
                  : "160px"
              }
              priority={priority}
            />
          </div>

          {/* Info Content */}
          <div className="flex flex-col gap-1 p-3">
            <h3 className="line-clamp-1 text-sm font-bold text-white">
              {name}
            </h3>
            {subtext && (
              <p className="line-clamp-1 text-xs text-gray-400 font-medium">
                {subtext}
              </p>
            )}
          </div>
        </Link>

        {/* Action slot - positioned over the image */}
        {renderAction && (
          <div className="absolute top-2 right-2 z-10">
            {renderAction({ personId: id, personName: name })}
          </div>
        )}
      </div>
    </div>
  )
}
