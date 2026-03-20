import type {
  PersonCastMember,
  PersonCrewMember,
  TMDBActionableMedia,
  TMDBPersonDetails,
} from "@/types/tmdb"

type PersonCredit = PersonCastMember | PersonCrewMember

export type PersonCreditMediaType = "movie" | "tv"
export type PersonCreditType = "cast" | "crew"

export interface PersonCreditsForMedia {
  cast: TMDBActionableMedia[]
  crew: TMDBActionableMedia[]
  count: number
}

export type PersonCreditsByMedia = Record<
  PersonCreditMediaType,
  PersonCreditsForMedia
>

export interface PersonCreditCombination {
  mediaType: PersonCreditMediaType
  creditType: PersonCreditType
  label: string
  count: number
  items: TMDBActionableMedia[]
}

export const PERSON_CREDIT_PREVIEW_LIMIT = 15

const PERSON_CREDIT_COMBINATION_ORDER = [
  ["movie", "cast"],
  ["movie", "crew"],
  ["tv", "cast"],
  ["tv", "crew"],
] as const

const RELEVANT_CREW_JOBS = [
  "Director",
  "Writer",
  "Screenplay",
  "Story",
  "Creator",
  "Executive Producer",
] as const

const EXCLUDED_TV_GENRE_IDS = [10767, 10763, 10764]

const deduplicateById = <T extends { id: number }>(items: T[]): T[] => {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const isRelevantCrewCredit = (job: string) =>
  RELEVANT_CREW_JOBS.some((relevantJob) => job.includes(relevantJob))

const isScriptedTVCredit = (credit: PersonCredit) =>
  !credit.genre_ids.some((genreId) => EXCLUDED_TV_GENRE_IDS.includes(genreId))

const sortByPopularity = <T extends { popularity: number }>(items: T[]) =>
  [...items].sort((a, b) => b.popularity - a.popularity)

const mapCreditToActionableMedia = (credit: PersonCredit): TMDBActionableMedia => ({
  ...credit,
  original_language: "",
  ...(credit.media_type === "movie"
    ? { original_title: credit.original_title }
    : { original_name: credit.original_name }),
})

export function getPersonCreditTypeLabel(creditType: PersonCreditType) {
  return creditType === "cast" ? "Acting" : "Directed/Written"
}

export function getPersonCreditCombinationLabel(
  mediaType: PersonCreditMediaType,
  creditType: PersonCreditType,
) {
  return `${mediaType === "movie" ? "Movie" : "TV"} ${getPersonCreditTypeLabel(creditType)}`
}

export function getPersonCreditTypeOrder(
  knownForDepartment: string,
): PersonCreditType[] {
  return knownForDepartment === "Acting" ? ["cast", "crew"] : ["crew", "cast"]
}

export function isPersonCreditMediaType(
  value: string | undefined,
): value is PersonCreditMediaType {
  return value === "movie" || value === "tv"
}

export function isPersonCreditType(
  value: string | undefined,
): value is PersonCreditType {
  return value === "cast" || value === "crew"
}

export function buildPersonCredits(
  person: TMDBPersonDetails,
): PersonCreditsByMedia {
  const castCredits = person.combined_credits?.cast || []
  const crewCredits = person.combined_credits?.crew || []

  const buildMediaCredits = (mediaType: PersonCreditMediaType) => {
    const isVisibleCredit = (credit: PersonCredit) =>
      credit.media_type === mediaType &&
      Boolean(credit.poster_path) &&
      (mediaType === "movie" || isScriptedTVCredit(credit))

    const cast = sortByPopularity(
      deduplicateById(castCredits.filter(isVisibleCredit)),
    ).map(mapCreditToActionableMedia)

    const crew = sortByPopularity(
      deduplicateById(
        crewCredits.filter(
          (credit) =>
            isVisibleCredit(credit) && isRelevantCrewCredit(credit.job),
        ),
      ),
    ).map(mapCreditToActionableMedia)

    return {
      cast,
      crew,
      count: new Set([...cast, ...crew].map((credit) => credit.id)).size,
    }
  }

  return {
    movie: buildMediaCredits("movie"),
    tv: buildMediaCredits("tv"),
  }
}

export function getAvailablePersonCreditCombinations(
  creditsByMedia: PersonCreditsByMedia,
): PersonCreditCombination[] {
  return PERSON_CREDIT_COMBINATION_ORDER.map(([mediaType, creditType]) => ({
    mediaType,
    creditType,
    label: getPersonCreditCombinationLabel(mediaType, creditType),
    count: creditsByMedia[mediaType][creditType].length,
    items: creditsByMedia[mediaType][creditType],
  })).filter((combination) => combination.count > 0)
}

export function resolveInitialPersonCreditsSelection(
  person: TMDBPersonDetails,
  requestedMediaType?: string,
  requestedCreditType?: string,
) {
  const creditsByMedia = buildPersonCredits(person)
  const availableCombinations = getAvailablePersonCreditCombinations(creditsByMedia)

  const requestedCombination =
    isPersonCreditMediaType(requestedMediaType) &&
    isPersonCreditType(requestedCreditType)
      ? availableCombinations.find(
          (combination) =>
            combination.mediaType === requestedMediaType &&
            combination.creditType === requestedCreditType,
        )
      : null

  const fallbackCombination = availableCombinations[0] || {
    mediaType: "movie" as const,
    creditType: "cast" as const,
  }

  const resolvedCombination = requestedCombination || fallbackCombination

  return {
    mediaType: resolvedCombination.mediaType,
    creditType: resolvedCombination.creditType,
  }
}
