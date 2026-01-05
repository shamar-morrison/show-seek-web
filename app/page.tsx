import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { getHeroMediaList } from "@/lib/tmdb"

/**
 * Home Page
 * Server component that fetches trending media and composes the home screen
 */
export default async function HomePage() {
  // Fetch top 5 trending media for the hero carousel
  const heroMediaList = await getHeroMediaList(5)

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <HeroSection mediaList={heroMediaList} />
    </main>
  )
}
