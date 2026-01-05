import { buildImageUrl } from "@/lib/tmdb"
import type { CastMember } from "@/types/tmdb"
import Image from "next/image"
import Link from "next/link"

interface CastCardProps {
  /** Cast member data */
  cast: CastMember
  /** Priority loading for above-the-fold images */
  priority?: boolean
}

/**
 * CastCard Component
 * Displays a cast member's photo, name, and character
 * Links to the person detail page
 */
export function CastCard({ cast, priority = false }: CastCardProps) {
  const profileUrl = buildImageUrl(cast.profile_path, "w500")

  return (
    <Link href={`/person/${cast.id}`} className="block shrink-0">
      <div className="group relative w-36 overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer sm:w-40">
        {/* Profile Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {profileUrl ? (
            <Image
              src={profileUrl}
              alt={cast.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="160px"
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500 text-sm">
              No Photo
            </div>
          )}
        </div>

        {/* Info Content */}
        <div className="flex flex-col gap-1 p-3">
          <h3 className="line-clamp-1 text-sm font-bold text-white">
            {cast.name}
          </h3>
          <p className="line-clamp-1 text-xs text-gray-400">{cast.character}</p>
        </div>
      </div>
    </Link>
  )
}
