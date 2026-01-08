import { WatchListsClient } from "@/app/lists/watch-lists/watch-lists-client"
import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"

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
    <>
      <PageHeader title="Watch Lists" />
      <WatchListsClient />
    </>
  )
}
