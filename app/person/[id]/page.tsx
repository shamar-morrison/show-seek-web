import { FavoritePersonButton } from "@/components/favorite-person-button"
import { PageContainer } from "@/components/page-container"
import { PersonBiography } from "@/components/person-biography"
import { PersonContent } from "@/components/person-content"
import { buildImageUrl, getPersonDetails } from "@/lib/tmdb"
import { calculateTmdbAge, formatTmdbDate } from "@/lib/tmdb-date"
import { Metadata } from "next"
import { notFound } from "next/navigation"

interface PersonPageProps {
  params: Promise<{
    id: string
  }>
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
  const age = calculateTmdbAge(person.birthday, person.deathday)
  const formattedBirthday = person.birthday
    ? formatTmdbDate(person.birthday, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const ageDisplay =
    age === null
      ? ""
      : person.deathday
        ? ` (${age} years old at death)`
        : ` (${age} years old)`

  const birthdayDisplay = formattedBirthday
    ? `${formattedBirthday}${ageDisplay}`
    : "N/A"

  return (
    <main className="min-h-screen bg-black text-white pt-28">
      <PageContainer className="py-8">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Left Sidebar (Profile Info) */}
          <div className="w-full md:w-1/4 lg:w-1/5">
            <div className="space-y-6">
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

            <PersonBiography
              biography={person.biography}
              personName={person.name}
            />

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
