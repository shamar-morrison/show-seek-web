import { PageHeader } from "@/components/page-header"
import { RouteGuard } from "@/components/route-guard"
import { WhereToWatchPageClient } from "@/components/where-to-watch-page-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Where to Watch | ShowSeek",
  description: "Find what you can stream from your ShowSeek lists.",
}

export default function WhereToWatchPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pb-12 pt-36 sm:px-8 lg:px-12">
        <RouteGuard
          title="Sign in to use Where to Watch"
          message="Compare streaming availability across your saved lists."
        >
          <PageHeader
            title="Where to Watch"
            description="Check which saved movies and shows are available on each streaming service."
          />
          <WhereToWatchPageClient />
        </RouteGuard>
      </div>
    </main>
  )
}
