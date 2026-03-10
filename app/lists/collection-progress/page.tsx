import { CollectionProgressClient } from "@/app/lists/collection-progress/collection-progress-client"
import { PageHeader } from "@/components/page-header"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Collection Progress | ShowSeek",
  description: "Track your progress across movie collections",
}

export default function CollectionProgressPage() {
  return (
    <>
      <PageHeader title="Collection Progress" />
      <CollectionProgressClient />
    </>
  )
}
