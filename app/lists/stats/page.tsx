import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { StatsClient } from "@/components/stats/stats-client"
import { getHistoryGenres } from "@/lib/history/genres"

export const metadata: Metadata = {
  title: "Stats & History | ShowSeek",
  description: "Your viewing stats and monthly activity",
}
export default async function StatsPage() {
  const genres = await getHistoryGenres()
  return (
    <>
      <PageHeader
        title="Stats & History"
        description="Your viewing activity, month by month."
      />
      <StatsClient genres={genres} />
    </>
  )
}
