import { Navbar } from "@/components/navbar"
import { Metadata } from "next"
import { notFound } from "next/navigation"

interface PersonPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Person Detail Page (Placeholder)
 * Will display actor/crew member details in the future
 */
export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params
  const personId = parseInt(id, 10)

  if (isNaN(personId)) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Person Details</h1>
          <p className="text-gray-400">Person ID: {personId}</p>
          <p className="text-gray-500 mt-2 text-sm">Coming soon...</p>
        </div>
      </div>
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const { id } = await params
  const personId = parseInt(id, 10)

  if (isNaN(personId)) {
    return { title: "Person Not Found | ShowSeek" }
  }

  return {
    title: `Person ${personId} | ShowSeek`,
    description: "Actor and crew member details",
  }
}
