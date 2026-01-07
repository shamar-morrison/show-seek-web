import { FavoritePeopleClient } from "@/app/lists/favorite-people/favorite-people-client"
import { Navbar } from "@/components/navbar"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Favorite People | ShowSeek",
  description: "View and manage your favorite actors, directors, and creators",
}

/**
 * Favorite People Page
 * Displays user's favorite persons with search filtering
 */
export default function FavoritePeoplePage() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Favorite People</h1>
        <FavoritePeopleClient />
      </div>
    </main>
  )
}
