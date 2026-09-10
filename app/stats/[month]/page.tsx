import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { RouteGuard } from "@/components/route-guard"
import { MonthDetailClient } from "./month-detail-client"

function isMonthParam(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>
}): Promise<Metadata> {
  const { month } = await params
  return {
    title: isMonthParam(month)
      ? `${month} Stats | ShowSeek`
      : "Stats | ShowSeek",
    description: "Monthly watch-time breakdown",
  }
}

/**
 * Month-detail drill-down route (/stats/YYYY-MM).
 * Shares the stats caches; per the backfill contract, a direct visit without
 * a prior /stats mount in the session gets no backfill that session and
 * renders stamped values plus in-memory fallbacks.
 */
export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ month: string }>
}) {
  const { month } = await params

  if (!isMonthParam(month)) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <RouteGuard
          title="Sign in to view your stats"
          message="Track movies and TV shows to see your monthly breakdown here."
        >
          <MonthDetailClient monthKey={month} />
        </RouteGuard>
      </div>
    </main>
  )
}
