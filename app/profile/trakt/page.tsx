import { Metadata } from "next"
import { TraktSettingsClient } from "./trakt-settings-client"

export const metadata: Metadata = {
  title: "Trakt Settings | Show Seek",
  description: "Manage your Trakt integration",
}

export default function TraktSettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-8 pt-24">
      <TraktSettingsClient />
    </main>
  )
}
