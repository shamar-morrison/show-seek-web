import { WatchProgressClient } from "@/app/lists/watch-progress/watch-progress-client"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Watch Progress | ShowSeek",
  description: "Track your TV show watch progress",
}

/**
 * Watch Progress Page
 * Displays user's TV show watch progress
 */
export default function WatchProgressPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Watch Progress</h1>
        <WatchProgressClient />
      </div>
    </main>
  )
}
