import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { StatsClient } from "@/components/stats/stats-client"
import { getHistoryGenres } from "@/lib/history/genres"
import { historyMonthName, isHistoryMonth } from "@/lib/history/month"

type Props = { params: Promise<{ month: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params
  return {
    title: `${isHistoryMonth(month) ? historyMonthName(month) : "Stats & History"} | ShowSeek`,
  }
}
export default async function MonthStatsPage({ params }: Props) {
  const { month } = await params
  if (!isHistoryMonth(month)) notFound()
  const genres = await getHistoryGenres()
  return (
    <>
      <Link
        href="/lists/stats"
        className="mb-5 inline-flex text-sm text-gray-400 transition-colors hover:text-white"
      >
        ← Stats & History
      </Link>
      <PageHeader
        title={historyMonthName(month)}
        description="Your watched titles, ratings, and list additions."
      />
      <StatsClient key={month} genres={genres} month={month} />
    </>
  )
}
