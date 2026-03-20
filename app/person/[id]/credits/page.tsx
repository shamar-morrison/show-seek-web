import { PersonCreditsClient } from "@/components/person-credits-client"
import {
  resolveInitialPersonCreditsSelection,
  type PersonCreditType,
  type PersonCreditMediaType,
} from "@/lib/person-credits"
import { getPersonDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface PersonCreditsPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    mediaType?: string
    creditType?: string
  }>
}

export default async function PersonCreditsPage({
  params,
  searchParams,
}: PersonCreditsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const personId = parseInt(id, 10)

  if (isNaN(personId)) {
    notFound()
  }

  const person = await getPersonDetails(personId)

  if (!person) {
    notFound()
  }

  const initialSelection = resolveInitialPersonCreditsSelection(
    person,
    query.mediaType,
    query.creditType,
  )

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-24 pb-12 sm:px-8 lg:px-12">
        <PersonCreditsClient
          person={person}
          initialMediaType={
            initialSelection.mediaType as PersonCreditMediaType
          }
          initialCreditType={
            initialSelection.creditType as PersonCreditType
          }
        />
      </div>
    </main>
  )
}

export async function generateMetadata({
  params,
}: Pick<PersonCreditsPageProps, "params">): Promise<Metadata> {
  const { id } = await params
  const personId = parseInt(id, 10)

  if (isNaN(personId)) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  const person = await getPersonDetails(personId)

  if (!person) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  return {
    title: `${person.name} Credits | ShowSeek`,
    description: `Browse ${person.name}'s acting and directed/written credits.`,
  }
}
