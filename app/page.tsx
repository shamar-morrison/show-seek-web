import { HomePageClient } from "@/components/home-page-client"
import { enrichHeroMediaWithBrightness } from "@/lib/logo-brightness"
import {
  getHeroMediaList,
  getLatestTrailers,
  getPopularMovies,
  getTopRatedMovies,
  getTopRatedTV,
  getTrendingMedia,
  getUpcomingMovies,
  getUpcomingTV,
} from "@/lib/tmdb"

export const revalidate = 3600 // Revalidate every hour

export default async function Home() {
  // Fetch all required data in parallel
  const [
    heroMediaListRaw,
    trendingList,
    popularMovies,
    topRatedMovies,
    topRatedTV,
    upcomingMovies,
    upcomingTV,
    latestTrailers,
  ] = await Promise.all([
    getHeroMediaList(),
    getTrendingMedia("day"),
    getPopularMovies(),
    getTopRatedMovies(),
    getTopRatedTV(),
    getUpcomingMovies(),
    getUpcomingTV(),
    getLatestTrailers(10),
  ])

  // Enrich hero media with logo brightness analysis (server-side only)
  const heroMediaList = await enrichHeroMediaWithBrightness(heroMediaListRaw)

  return (
    <HomePageClient
      heroMediaList={heroMediaList}
      trendingList={trendingList}
      popularMovies={popularMovies}
      topRatedMovies={topRatedMovies}
      topRatedTV={topRatedTV}
      upcomingMovies={upcomingMovies}
      upcomingTV={upcomingTV}
      latestTrailers={latestTrailers}
    />
  )
}
