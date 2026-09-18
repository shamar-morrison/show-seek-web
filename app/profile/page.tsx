import { Metadata } from "next"
import { ProfilePageClient } from "./profile-page-client"
import { PageContainer } from "@/components/page-container"
import { RouteGuard } from "@/components/route-guard"

export const metadata: Metadata = {
  title: "Profile & Settings | ShowSeek",
  description: "Manage your profile, preferences, and account settings",
}

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-black">
      <PageContainer className="pt-36 pb-12">
        <RouteGuard
          title="Sign in to view your profile"
          message="Manage your preferences and account settings."
        >
          <ProfilePageClient />
        </RouteGuard>
      </PageContainer>
    </main>
  )
}
