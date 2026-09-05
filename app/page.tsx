import { HomePageClient } from "@/components/home-page-client"
import { enrichHeroMediaWithBrightness } from "@/lib/logo-brightness"
import {
  getHeroMediaList,
  getPopularMovies,
  getTopRatedMovies,
  getTopRatedTV,
  getTrendingMoviesPaginated,
  getTrendingTVPaginated,
  getUpcomingMovies,
  getUpcomingTV,
} from "@/lib/tmdb"

export const revalidate = 3600 // Revalidate every hour

export default async function Home() {
  // Fetch all required data in parallel.
  // Trending movies/TV use dedicated endpoints (first page each) so both
  // rails get full ~20-item lists instead of splitting one mixed page.
  const [
    heroMediaListRaw,
    trendingMoviesData,
    trendingTVData,
    popularMovies,
    topRatedMovies,
    topRatedTV,
    upcomingMovies,
    upcomingTV,
  ] = await Promise.all([
    getHeroMediaList(),
    getTrendingMoviesPaginated(1),
    getTrendingTVPaginated(1),
    getPopularMovies(),
    getTopRatedMovies(),
    getTopRatedTV(),
    getUpcomingMovies(),
    getUpcomingTV(),
  ])

  // Enrich hero media with logo brightness analysis (server-side only)
  const heroMediaList = await enrichHeroMediaWithBrightness(heroMediaListRaw)

  return (
    <HomePageClient
      heroMediaList={heroMediaList}
      trendingMovies={trendingMoviesData.results}
      trendingTV={trendingTVData.results}
      popularMovies={popularMovies}
      topRatedMovies={topRatedMovies}
      topRatedTV={topRatedTV}
      upcomingMovies={upcomingMovies}
      upcomingTV={upcomingTV}
    />
  )
}
