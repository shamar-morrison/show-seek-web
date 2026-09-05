import type { TMDBPersonExternalIds } from "@/types/tmdb"
import {
  Facebook01Icon,
  InstagramIcon,
  NewTwitterIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

interface SocialLink {
  key: "instagram" | "twitter" | "facebook" | "tiktok" | "youtube"
  label: string
  url: string
  icon: IconSvgElement
}

function getTrimmedExternalId(
  id: string | null | undefined,
): string | null {
  const trimmed = id?.trim()
  return trimmed ? trimmed : null
}

/**
 * Centered row of social profile links for a person.
 * Mirrors the mobile PersonDetailScreen social row: same networks, order,
 * URL formats, and id normalization (leading @ stripped for TikTok).
 * Renders nothing when the person has no social ids.
 */
export function PersonSocialLinks({
  externalIds,
}: {
  externalIds: TMDBPersonExternalIds | null | undefined
}) {
  const instagramId = getTrimmedExternalId(externalIds?.instagram_id)
  const twitterId = getTrimmedExternalId(externalIds?.twitter_id)
  const facebookId = getTrimmedExternalId(externalIds?.facebook_id)
  const youtubeId = getTrimmedExternalId(externalIds?.youtube_id)
  const tiktokId = (() => {
    const id = getTrimmedExternalId(externalIds?.tiktok_id)
    if (!id) return null
    const normalized = id.replace(/^@+/, "")
    return normalized || null
  })()

  const socialLinks: SocialLink[] = (
    [
      instagramId
        ? {
            key: "instagram",
            label: "Instagram",
            url: `https://www.instagram.com/${instagramId}`,
            icon: InstagramIcon,
          }
        : null,
      twitterId
        ? {
            key: "twitter",
            label: "Twitter",
            url: `https://x.com/${twitterId}`,
            icon: NewTwitterIcon,
          }
        : null,
      facebookId
        ? {
            key: "facebook",
            label: "Facebook",
            url: `https://www.facebook.com/${facebookId}`,
            icon: Facebook01Icon,
          }
        : null,
      tiktokId
        ? {
            key: "tiktok",
            label: "TikTok",
            url: `https://www.tiktok.com/@${tiktokId}`,
            icon: TiktokIcon,
          }
        : null,
      youtubeId
        ? {
            key: "youtube",
            label: "YouTube",
            url: `https://www.youtube.com/${youtubeId}`,
            icon: YoutubeIcon,
          }
        : null,
    ] as (SocialLink | null)[]
  ).filter((link): link is SocialLink => Boolean(link))

  if (socialLinks.length === 0) return null

  return (
    <div className="space-y-1">
      <h4 className="font-semibold text-gray-300">Social Links</h4>
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="person-social-links"
      >
      {socialLinks.map((socialLink) => (
        <a
          key={socialLink.key}
          href={socialLink.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={socialLink.label}
          title={socialLink.label}
          className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <HugeiconsIcon icon={socialLink.icon} className="size-5" />
        </a>
      ))}
      </div>
    </div>
  )
}
