import { WatchListsClient } from "@/app/lists/watch-lists/watch-lists-client"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Watch Lists | ShowSeek",
  description: "Manage your movie and TV show watch lists",
}

/**
 * Watch Lists Page
 * Displays user's default lists with tab navigation and search filtering
 */
export default function WatchListsPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Watch Lists</h1>
        <WatchListsClient />
      </div>
    </main>
  )
}
