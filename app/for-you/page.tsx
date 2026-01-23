"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { Button } from "@/components/ui/button"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { Skeleton } from "@/components/ui/skeleton"
import { useForYouRecommendations } from "@/hooks/use-for-you-recommendations"
import {
  Loading03Icon,
  SparklesIcon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

/**
 * For You Page
 * Personalized recommendations based on user's highly-rated content.
 */
export default function ForYouPage() {
  const {
    sections,
    hiddenGems,
    trendingMovies,
    isLoading,
    hasEnoughData,
    needsFallback,
    isGuest,
  } = useForYouRecommendations()

  // Guest State - prompt to sign in
  if (isGuest) {
    return (
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon
              icon={SparklesIcon}
              className="size-10 text-primary"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">
              Sign in for personalized picks
            </h1>
            <p className="max-w-md text-muted-foreground">
              Get recommendations tailored to your taste based on the movies and
              TV shows you love.
            </p>
          </div>
          <Button asChild size="lg" className="mt-4">
            <Link href="/">Sign In</Link>
          </Button>
        </div>
      </main>
    )
  }

  // Loading State
  if (isLoading && sections.length === 0) {
    return (
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-6 w-64" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton
                    key={j}
                    className="h-[240px] w-[160px] shrink-0 rounded-xl"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  // Empty State - not enough ratings
  if (!hasEnoughData && !needsFallback) {
    return (
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-yellow-500/10">
            <HugeiconsIcon
              icon={StarIcon}
              className="size-10 fill-yellow-500 text-yellow-500"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              Not enough data yet
            </h1>
            <p className="max-w-md text-muted-foreground">
              Rate 3+ movies or shows you love (8/10 or higher) to unlock
              personalized recommendations here!
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-4">
            <Link href="/discover">Explore & Rate</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 pt-24 pb-16">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={SparklesIcon} className="size-8 text-primary" />
          <h1 className="text-3xl font-bold text-white">Just For You</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Personalized picks based on what you&apos;ve rated highly.
        </p>
      </div>

      <div className="space-y-12">
        {/* Personalized Sections - "Because you loved X" */}
        {sections.map((section) => (
          <Section
            key={`${section.seed.mediaType}-${section.seed.id}`}
            title={`Because you loved ${section.seed.title}`}
          >
            {section.isLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton
                    key={j}
                    className="h-[240px] w-[160px] shrink-0 rounded-xl"
                  />
                ))}
              </div>
            ) : (
              <ScrollableRow className="pb-2">
                {section.recommendations.slice(0, 15).map((item) => (
                  <div
                    key={`${item.media_type}-${item.id}`}
                    className="w-[140px] shrink-0 sm:w-[160px]"
                  >
                    <MediaCardWithActions media={item} />
                  </div>
                ))}
              </ScrollableRow>
            )}
          </Section>
        ))}

        {/* Hidden Gems Section */}
        {hiddenGems.length > 0 && (
          <Section title="✨ Hidden Gems">
            <p className="mb-4 text-sm text-muted-foreground">
              Critically acclaimed but under-the-radar picks you might love.
            </p>
            <ScrollableRow className="pb-2">
              {hiddenGems.slice(0, 20).map((item) => (
                <div
                  key={`gem-${item.id}`}
                  className="w-[140px] shrink-0 sm:w-[160px]"
                >
                  <MediaCardWithActions media={item} />
                </div>
              ))}
            </ScrollableRow>
          </Section>
        )}

        {/* Trending Fallback - when user needs more data */}
        {needsFallback && trendingMovies.length > 0 && (
          <Section title="Trending This Week">
            <p className="mb-4 text-sm text-muted-foreground">
              Rate more content to unlock personalized recommendations!
            </p>
            <ScrollableRow className="pb-2">
              {trendingMovies.slice(0, 20).map((item) => (
                <div
                  key={`trending-${item.media_type}-${item.id}`}
                  className="w-[140px] shrink-0 sm:w-[160px]"
                >
                  <MediaCardWithActions media={item} />
                </div>
              ))}
            </ScrollableRow>
          </Section>
        )}

        {/* Loading indicator for additional sections */}
        {isLoading && sections.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-8 animate-spin text-primary"
            />
          </div>
        )}
      </div>
    </main>
  )
}
