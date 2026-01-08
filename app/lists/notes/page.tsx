import { NotesClient } from "@/app/lists/notes/notes-client"
import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "My Notes | ShowSeek",
  description: "View and manage your personal notes for movies and TV shows",
}

/**
 * Notes Page
 * Displays user's notes with search and management functionality
 */
export default function NotesPage() {
  return (
    <>
      <PageHeader title="My Notes" />
      <NotesClient />
    </>
  )
}
