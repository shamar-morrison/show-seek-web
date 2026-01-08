import { FavoritePeopleClient } from "@/app/lists/favorite-people/favorite-people-client"
import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Favorite People | ShowSeek",
  description: "View and manage your favorite actors, directors, and creators",
}

/**
 * Favorite People Page
 * Displays user's favorite persons with search filtering
 */
export default function FavoritePeoplePage() {
  return (
    <>
      <PageHeader title="Favorite People" />
      <FavoritePeopleClient />
    </>
  )
}
