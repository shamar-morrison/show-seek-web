import { Metadata } from "next"
import { RatingsPageClient } from "./ratings-page-client"

export const metadata: Metadata = {
  title: "My Ratings | ShowSeek",
  description: "View and manage your movie and TV show ratings",
}

/**
 * Ratings Page
 * Displays user's ratings with tab navigation between Movies and TV Shows
 */
export default function RatingsPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">My Ratings</h1>
        <RatingsPageClient />
      </div>
    </main>
  )
}
