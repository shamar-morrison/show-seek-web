export interface MoodConfig {
  id: string
  label: string
  description: string
  supportingText: string
  emoji: string
  color: string
  movieGenres: number[]
  tvGenres: number[]
  keywords: number[]
  movieExcludeGenres?: number[]
  tvExcludeGenres?: number[]
}

export const MOODS: MoodConfig[] = [
  {
    id: "cozy",
    label: "Cozy",
    description: "Warm, funny, easy company.",
    supportingText: "Comfort watches, soft edges, and low-stakes joy.",
    emoji: "🧣",
    color: "#FF8C42",
    movieGenres: [35, 10751],
    tvGenres: [35, 10751],
    keywords: [9717, 155714, 6054, 9799],
    movieExcludeGenres: [27, 53],
    tvExcludeGenres: [],
  },
  {
    id: "mindBending",
    label: "Mind-Bending",
    description: "Twists, puzzles, strange realities.",
    supportingText: "Reality slips, motives blur, and every scene asks questions.",
    emoji: "🌀",
    color: "#21B6D7",
    movieGenres: [9648, 878],
    tvGenres: [9648, 10765],
    keywords: [275311, 10349, 1721, 156277, 11019],
    movieExcludeGenres: [],
    tvExcludeGenres: [],
  },
  {
    id: "adrenaline",
    label: "Adrenaline",
    description: "Chases, chaos, high stakes.",
    supportingText: "Fast cuts, bigger swings, and no patience for downtime.",
    emoji: "⚡",
    color: "#E74C3C",
    movieGenres: [28, 12],
    tvGenres: [10759],
    keywords: [1308, 1562, 14819, 9748, 14601],
    movieExcludeGenres: [],
    tvExcludeGenres: [],
  },
  {
    id: "heartbreaking",
    label: "Heartbreaking",
    description: "Tender stories that land hard.",
    supportingText: "Love, loss, and the kind of drama that lingers after credits.",
    emoji: "💔",
    color: "#4A90E2",
    movieGenres: [18, 10749],
    tvGenres: [18],
    keywords: [6270, 4336, 10683, 5216, 9672],
    movieExcludeGenres: [35],
    tvExcludeGenres: [35],
  },
  {
    id: "spooky",
    label: "Spooky",
    description: "Shadows, tension, supernatural dread.",
    supportingText: "Ghosts, hauntings, and the slow burn before the scare lands.",
    emoji: "👻",
    color: "#1A1A2E",
    movieGenres: [27, 53],
    tvGenres: [9648],
    keywords: [162846, 10224, 3133, 12339, 224636],
    movieExcludeGenres: [],
    tvExcludeGenres: [35],
  },
  {
    id: "whimsical",
    label: "Whimsical",
    description: "Magic, wonder, and soft escapism.",
    supportingText: "Playful worlds, strange charm, and a little lift from reality.",
    emoji: "✨",
    color: "#F4B942",
    movieGenres: [14, 16],
    tvGenres: [10765, 16],
    keywords: [2343, 4344, 177912, 1826, 3205],
    movieExcludeGenres: [27],
    tvExcludeGenres: [],
  },
]

export function getMoodById(id: string) {
  return MOODS.find((mood) => mood.id === id)
}

export function getRandomMood(excludeId?: string) {
  const availableMoods = excludeId
    ? MOODS.filter((mood) => mood.id !== excludeId)
    : MOODS

  const pool = availableMoods.length > 0 ? availableMoods : MOODS
  const randomIndex = Math.floor(Math.random() * pool.length)
  return pool[randomIndex]
}

export function formatMoodGenres(
  mood: MoodConfig,
  mediaType: "movie" | "tv",
) {
  const genres = mediaType === "movie" ? mood.movieGenres : mood.tvGenres
  return genres.join("|")
}

export function formatMoodKeywords(mood: MoodConfig) {
  return mood.keywords.join("|")
}

export function formatExcludedGenres(
  mood: MoodConfig,
  mediaType: "movie" | "tv",
) {
  const excludedGenres =
    mediaType === "movie" ? mood.movieExcludeGenres : mood.tvExcludeGenres

  if (!excludedGenres || excludedGenres.length === 0) {
    return undefined
  }

  return excludedGenres.join(",")
}
