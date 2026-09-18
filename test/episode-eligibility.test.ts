import { getMarkableEpisodes } from "@/lib/episode-eligibility"
import { describe, expect, it } from "vitest"

function episode(air_date: string | null, episode_number = 1) {
  return {
    id: episode_number,
    episode_number,
    name: `Episode ${episode_number}`,
    air_date,
  }
}

const PAST = "2020-01-01"
const FUTURE = "2999-01-01"

describe("getMarkableEpisodes", () => {
  it("includes only aired episodes when unreleased watches are disabled", () => {
    const result = getMarkableEpisodes([episode(PAST), episode(FUTURE)], false)
    expect(result).toHaveLength(1)
    expect(result[0].air_date).toBe(PAST)
  })

  it("includes future episodes when unreleased watches are enabled", () => {
    const result = getMarkableEpisodes([episode(PAST), episode(FUTURE)], true)
    expect(result.map((item) => item.air_date)).toEqual([PAST, FUTURE])
  })

  it("never includes dateless episodes, even when unreleased watches are enabled", () => {
    const result = getMarkableEpisodes([episode(PAST), episode(null)], true)
    expect(result).toHaveLength(1)
    expect(result[0].air_date).toBe(PAST)
  })

  it("never includes dateless episodes when unreleased watches are disabled", () => {
    const result = getMarkableEpisodes([episode(PAST), episode(null)], false)
    expect(result).toHaveLength(1)
  })
})
