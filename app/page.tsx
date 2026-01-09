import { HomePageClient } from "@/components/home-page-client"
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
    heroMediaList,
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
