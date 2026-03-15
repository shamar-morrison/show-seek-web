import { FavoriteEpisodesClient } from "@/app/lists/favorite-episodes/favorite-episodes-client"
import { PageHeader } from "@/components/page-header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Favorite Episodes | ShowSeek",
  description: "View and manage your favorite TV episodes",
}

export default function FavoriteEpisodesPage() {
  return (
    <>
      <PageHeader title="Favorite Episodes" />
      <FavoriteEpisodesClient />
    </>
  )
}
