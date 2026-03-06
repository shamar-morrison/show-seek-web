import { parseAggregationCount } from "@/lib/firebase/server-firestore"
import { describe, expect, it } from "vitest"

describe("firebase server firestore helpers", () => {
  it("parses Firestore aggregation count payloads", () => {
    const payload = [
      JSON.stringify({
        result: {
          aggregateFields: {
            total: {
              integerValue: "7",
            },
          },
        },
      }),
      "",
    ].join("\n")

    expect(parseAggregationCount(payload)).toBe(7)
  })

  it("returns zero when the aggregation payload is empty", () => {
    expect(parseAggregationCount("")).toBe(0)
    expect(parseAggregationCount("{}")).toBe(0)
  })
})
