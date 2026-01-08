import { Metadata } from "next"
import { CustomListsClient } from "./custom-lists-client"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Custom Lists | ShowSeek",
  description: "Manage your custom movie and TV show lists",
}

/**
 * Custom Lists Page
 * Displays user's custom lists with tab navigation and search filtering
 */
export default function CustomListsPage() {
  return (
    <>
      <PageHeader title="Custom Lists" />
      <CustomListsClient />
    </>
  )
}
