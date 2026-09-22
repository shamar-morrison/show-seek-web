import { describe, expect, it } from "vitest"

import robots from "@/app/robots"

describe("robots metadata route", () => {
  it("blocks AhrefsBot and all three Awario crawler forms from the whole site", async () => {
    const config = robots()
    const rules = Array.isArray(config.rules)
      ? config.rules
      : [config.rules]

    const blockingBots = rules
      .filter(
        (rule) =>
          rule.disallow === "/" ||
          (Array.isArray(rule.disallow) && rule.disallow.includes("/")),
      )
      .map((rule) => rule.userAgent)

    expect(blockingBots).toContain("AhrefsBot")
    expect(blockingBots).toContain("AwarioBot")
    expect(blockingBots).toContain("AwarioSmartBot")
    expect(blockingBots).toContain("AwarioRssBot")
  })

  it("allows all other user agents across the site", async () => {
    const config = robots()
    const rules = Array.isArray(config.rules)
      ? config.rules
      : [config.rules]

    const wildcard = rules.find((rule) => rule.userAgent === "*")
    expect(wildcard).toBeDefined()
    expect(wildcard?.allow).toBe("/")
  })

  it("references the sitemap", async () => {
    const config = robots()

    expect(config.sitemap).toBe("https://show-seek.app/sitemap.xml")
  })
})
