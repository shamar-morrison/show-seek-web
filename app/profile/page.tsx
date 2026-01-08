import { Navbar } from "@/components/navbar"
import { Metadata } from "next"
import { ProfilePageClient } from "./profile-page-client"

export const metadata: Metadata = {
  title: "Profile & Settings | ShowSeek",
  description: "Manage your profile, preferences, and account settings",
}

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 pt-36 pb-12">
        <ProfilePageClient />
      </div>
    </main>
  )
}
