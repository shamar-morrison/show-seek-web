import {
  getFirebaseServiceAccountConfig,
  getGoogleAccessToken,
} from "./server-api"

interface FirestoreDocument {
  fields?: Record<string, unknown>
}

export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  const config = getFirebaseServiceAccountConfig()
  const accessToken = await getGoogleAccessToken()

  if (!config || !accessToken) {
    return false
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (response.status === 404) {
    return false
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to fetch Firestore user document: ${details}`)
  }

  const document = (await response.json()) as FirestoreDocument
  return readBooleanField(document, ["premium", "isPremium"])
}

export async function countCustomLists(userId: string): Promise<number> {
  const config = getFirebaseServiceAccountConfig()
  const accessToken = await getGoogleAccessToken()

  if (!config || !accessToken) {
    return 0
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${userId}:runAggregationQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: "lists" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "isCustom" },
                op: "EQUAL",
                value: { booleanValue: true },
              },
            },
          },
          aggregations: [
            {
              alias: "total",
              count: {},
            },
          ],
        },
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to count Firestore custom lists: ${details}`)
  }

  const payload = await response.text()
  return parseAggregationCount(payload)
}

export function parseAggregationCount(payload: string): number {
  const records = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)

  for (const record of records) {
    const total = getNestedValue(record, [
      "result",
      "aggregateFields",
      "total",
      "integerValue",
    ])

    if (typeof total === "string") {
      return Number.parseInt(total, 10)
    }

    if (typeof total === "number") {
      return total
    }
  }

  return 0
}

function readBooleanField(
  document: FirestoreDocument,
  path: [string, string],
): boolean {
  const [rootField, leafField] = path
  const booleanValue = getNestedValue(document, [
    "fields",
    rootField ?? "",
    "mapValue",
    "fields",
    leafField ?? "",
    "booleanValue",
  ])

  return booleanValue === true || booleanValue === "true"
}

function getNestedValue(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, value)
}
