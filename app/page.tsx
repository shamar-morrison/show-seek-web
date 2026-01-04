import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { getHeroMedia } from "@/lib/tmdb"

/**
 * Home Page
 * Server component that fetches trending media and composes the home screen
 */
export default async function HomePage() {
  // Fetch trending media for the hero section
  const heroMedia = await getHeroMedia()

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <HeroSection media={heroMedia} />
    </main>
  )
}
