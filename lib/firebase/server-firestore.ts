import {
  getFirebaseServiceAccountConfig,
  getGoogleAccessToken,
} from "./server-api"

const FIRESTORE_REQUEST_TIMEOUT_MS = 10_000

interface FirestoreDocument {
  fields?: Record<string, unknown>
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

async function fetchFirestoreWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> {
  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort(),
    FIRESTORE_REQUEST_TIMEOUT_MS,
  )

  try {
    return await fetch(input, {
      ...init,
      signal: abortController.signal,
    })
  } catch (error) {
    if (abortController.signal.aborted || isAbortError(error)) {
      throw new Error(timeoutMessage)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getFirestoreRequestContext(): Promise<{
  accessToken: string
  projectId: string
}> {
  const config = getFirebaseServiceAccountConfig()

  if (!config) {
    throw new Error(
      "Missing Firebase service account configuration (getFirebaseServiceAccountConfig returned null)",
    )
  }

  const accessToken = await getGoogleAccessToken()

  if (!accessToken) {
    throw new Error(
      "Missing Google access token for Firestore server access (getGoogleAccessToken returned null)",
    )
  }

  return {
    accessToken,
    projectId: config.projectId,
  }
}

export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  const { accessToken, projectId } = await getFirestoreRequestContext()

  const response = await fetchFirestoreWithTimeout(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    `Firestore user document request timed out after ${FIRESTORE_REQUEST_TIMEOUT_MS}ms`,
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
  const { accessToken, projectId } = await getFirestoreRequestContext()

  const response = await fetchFirestoreWithTimeout(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}:runAggregationQuery`,
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
    `Firestore custom list count request timed out after ${FIRESTORE_REQUEST_TIMEOUT_MS}ms`,
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
