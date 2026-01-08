import { Metadata } from "next"
import { CustomListsClient } from "./custom-lists-client"

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
      <h1 className="mb-8 text-3xl font-bold text-white">Custom Lists</h1>
      <CustomListsClient />
    </>
  )
}
