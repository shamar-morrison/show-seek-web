import { WatchProgressClient } from "@/app/lists/watch-progress/watch-progress-client"
import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"

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
    <>
      <PageHeader title="Watch Progress" />
      <WatchProgressClient />
    </>
  )
}
