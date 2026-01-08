import {
  getHeroMediaList,
  getTrendingMedia,
  getPopularMovies,
  getTopRatedTV,
  getUpcomingMovies,
} from "@/lib/tmdb"
import { HomePageClient } from "@/components/home-page-client"

export const revalidate = 3600 // Revalidate every hour

export default async function Home() {
  // Fetch all required data in parallel
  const [
    heroMediaList,
    trendingList,
    popularMovies,
    topRatedTV,
    upcomingMovies,
  ] = await Promise.all([
    getHeroMediaList(),
    getTrendingMedia("day"),
    getPopularMovies(),
    getTopRatedTV(),
    getUpcomingMovies(),
  ])

  return (
    <HomePageClient
      heroMediaList={heroMediaList}
      trendingList={trendingList}
      popularMovies={popularMovies}
      topRatedTV={topRatedTV}
      upcomingMovies={upcomingMovies}
    />
  )
}
