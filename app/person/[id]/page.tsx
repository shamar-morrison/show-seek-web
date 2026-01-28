import { FavoritePersonButton } from "@/components/favorite-person-button"
import { PageContainer } from "@/components/page-container"
import { PersonContent } from "@/components/person-content"
import { buildImageUrl, getPersonDetails } from "@/lib/tmdb"
import { Metadata } from "next"
import { notFound } from "next/navigation"

interface PersonPageProps {
  params: Promise<{
    id: string
  }>
}

function calculateAge(
  birthday: string | null,
  deathday: string | null = null,
): string | null {
  if (!birthday) return null
  const birthDate = new Date(birthday)
  const compareDate = deathday ? new Date(deathday) : new Date()

  if (isNaN(birthDate.getTime()) || isNaN(compareDate.getTime())) {
    return null
  }

  const birthYear = birthDate.getUTCFullYear()
  const birthMonth = birthDate.getUTCMonth()
  const birthDay = birthDate.getUTCDate()

  const compareYear = compareDate.getUTCFullYear()
  const compareMonth = compareDate.getUTCMonth()
  const compareDay = compareDate.getUTCDate()

  let years = compareYear - birthYear

  if (
    compareMonth < birthMonth ||
    (compareMonth === birthMonth && compareDay < birthDay)
  ) {
    years--
  }

  return years.toString()
}

function formatDate(dateString: string | null): string | null {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params
  const personId = parseInt(id, 10)

  if (isNaN(personId)) {
    notFound()
  }

  const person = await getPersonDetails(personId)

  if (!person) {
    notFound()
  }

  const profileUrl = buildImageUrl(person.profile_path, "original")
  const age = calculateAge(person.birthday, person.deathday)
  const formattedBirthday = formatDate(person.birthday)

  // Format birthday string like: "August 26, 1997 (29 years old)"
  const birthdayDisplay = formattedBirthday
    ? `${formattedBirthday}${age ? ` (${age} years old)` : ""}`
    : "N/A"

  return (
    <main className="min-h-screen bg-black text-white pt-28">
      <PageContainer className="py-8">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Left Sidebar (Profile Info) */}
          <div className="w-full md:w-1/4 lg:w-1/5">
            <div className="sticky top-24 space-y-6">
              {/* Profile Image */}
              <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-gray-900 shadow-lg">
                {profileUrl ? (
                  <img
                    src={profileUrl}
                    alt={person.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 25vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
              </div>

              {/* Add to Favorite Button */}
              <FavoritePersonButton
                person={{
                  id: person.id,
                  name: person.name,
                  profile_path: person.profile_path,
                  known_for_department: person.known_for_department,
                }}
              />

              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Personal Info</h3>

                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-300">Known For</h4>
                  <p className="text-sm text-gray-400">
                    {person.known_for_department}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-300">Birthday</h4>
                  <p className="text-sm text-gray-400">{birthdayDisplay}</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-300">
                    Place of Birth
                  </h4>
                  <p className="text-sm text-gray-400">
                    {person.place_of_birth || "N/A"}
                  </p>
                </div>

                {person.also_known_as && person.also_known_as.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-gray-300">
                      Also Known As
                    </h4>
                    <div className="flex flex-col gap-1">
                      {person.also_known_as.slice(0, 5).map((alias) => (
                        <p key={alias} className="text-sm text-gray-400">
                          {alias}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content (Bio & Credits) */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <h1 className="mb-6 text-4xl font-bold">{person.name}</h1>

            <div className="mb-8">
              <h2 className="mb-2 text-xl font-bold">Biography</h2>
              <div className="prose prose-invert max-w-none text-gray-300">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {person.biography ||
                    `We don't have a biography for ${person.name}.`}
                </p>
              </div>
            </div>

            <PersonContent person={person} />
          </div>
        </div>
      </PageContainer>
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

  const person = await getPersonDetails(personId)

  if (!person) {
    return { title: "Person Not Found | ShowSeek" }
  }

  return {
    title: `${person.name} | ShowSeek`,
    description:
      person.biography?.slice(0, 160) || `Details about ${person.name}`,
    openGraph: {
      images: [buildImageUrl(person.profile_path, "w500")].filter(
        Boolean,
      ) as string[],
    },
  }
}
