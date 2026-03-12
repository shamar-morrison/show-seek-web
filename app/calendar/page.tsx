import { Metadata } from "next"

import { ReleaseCalendarPageClient } from "@/components/release-calendar-page-client"
import { RouteGuard } from "@/components/route-guard"

export const metadata: Metadata = {
  title: "Release Calendar | ShowSeek",
  description:
    "Track upcoming movie releases and new TV episodes from your lists.",
}

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 pb-12 sm:px-8 lg:px-12">
        <RouteGuard
          title="Sign in to view your release calendar"
          message="Track upcoming movies and episodes from your watchlists and favorites."
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Release Calendar</h1>
            <p className="mt-2 text-white/60">
              Follow what&apos;s coming next from the titles you already track.
            </p>
          </div>
          <ReleaseCalendarPageClient />
        </RouteGuard>
      </div>
    </main>
  )
}
