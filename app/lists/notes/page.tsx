import { NotesClient } from "@/app/lists/notes/notes-client"
import { Navbar } from "@/components/navbar"
import { Metadata } from "next"

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
    <main className="min-h-screen bg-black">
      <Navbar />
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <h1 className="mb-8 text-3xl font-bold text-white">My Notes</h1>
        <NotesClient />
      </div>
    </main>
  )
}
