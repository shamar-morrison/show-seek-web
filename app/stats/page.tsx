import type { Metadata } from "next"
import { RouteGuard } from "@/components/route-guard"
import { StatsClient } from "./stats-client"

export const metadata: Metadata = {
  title: "Your Stats | ShowSeek",
  description: "Total hours watched and monthly breakdowns",
}

/**
 * Stats Page
 * Total Hours Watched with a last-6-months overview and monthly breakdowns.
 */
export default function StatsPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Your Stats</h1>
        <RouteGuard
          title="Sign in to view your stats"
          message="Track movies and TV shows to see your total hours watched here."
        >
          <StatsClient />
        </RouteGuard>
      </div>
    </main>
  )
}
