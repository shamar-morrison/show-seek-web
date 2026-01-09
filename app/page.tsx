import { HomePageClient } from "@/components/home-page-client"
import {
  getHeroMediaList,
  getLatestTrailers,
  getPopularMovies,
  getTopRatedTV,
  getTrendingMedia,
  getUpcomingMovies,
} from "@/lib/tmdb"

export const revalidate = 3600 // Revalidate every hour

export default async function Home() {
  // Fetch all required data in parallel
  const [
    heroMediaList,
    trendingList,
    popularMovies,
    topRatedTV,
    upcomingMovies,
    latestTrailers,
  ] = await Promise.all([
    getHeroMediaList(),
    getTrendingMedia("day"),
    getPopularMovies(),
    getTopRatedTV(),
    getUpcomingMovies(),
    getLatestTrailers(10),
  ])

  return (
    <HomePageClient
      heroMediaList={heroMediaList}
      trendingList={trendingList}
      popularMovies={popularMovies}
      topRatedTV={topRatedTV}
      upcomingMovies={upcomingMovies}
      latestTrailers={latestTrailers}
    />
  )
}
