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
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Custom Lists</h1>
        <CustomListsClient />
      </div>
    </main>
  )
}
