import {
  getFirebaseProjectId,
  getGoogleAccessToken,
  getFirebaseServiceAccountConfig,
} from "./server-api"

const SESSION_COOKIE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
const SESSION_COOKIE_EXPIRY_SECONDS = 5 * 24 * 60 * 60
const SESSION_COOKIE_NAME = "session"
const SESSION_EXPIRY_DAYS = 5

type JwksCache = {
  expiresAt: number
  keys: Map<string, FirebaseJwk>
}

export type SessionVerificationStatus = "valid" | "invalid" | "unavailable"
export type SessionVerificationMode = "local" | "strict"

export interface DecodedSessionCookie {
  aud: string
  auth_time: number
  exp: number
  iat: number
  iss: string
  sub: string
  user_id?: string
  [key: string]: unknown
}

export interface FirebaseAccountInfo {
  localId: string
  disabled?: boolean
  validSince?: string
  [key: string]: unknown
}

export type SessionVerificationResult =
  | {
      status: "valid"
      account: FirebaseAccountInfo | null
      claims: DecodedSessionCookie
      reason: null
    }
  | {
      status: Exclude<SessionVerificationStatus, "valid">
      account: null
      claims: null
      reason: string
    }

type FirebaseJwk = JsonWebKey & {
  kid?: string
}

class SessionVerificationError extends Error {
  constructor(
    readonly status: Exclude<SessionVerificationStatus, "valid">,
    message: string,
  ) {
    super(message)
    this.name = "SessionVerificationError"
  }
}

let jwksCache: JwksCache | null = null
const importedPublicKeys = new Map<string, CryptoKey>()

export { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }

export function isSessionVerificationValid(
  result: SessionVerificationResult,
): result is SessionVerificationResult & {
  status: "valid"
  account: FirebaseAccountInfo | null
  claims: DecodedSessionCookie
} {
  return result.status === "valid" && result.claims !== null
}

export function isSessionVerificationUnavailable(
  result: SessionVerificationResult,
): boolean {
  return result.status === "unavailable"
}

export async function createSessionCookie(
  idToken: string,
): Promise<string | null> {
  const config = getFirebaseServiceAccountConfig()
  const accessToken = await getGoogleAccessToken()

  if (!config || !accessToken) {
    console.warn(
      "Firebase service account credentials are not configured. Server-side auth will not work.",
    )
    return null
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}:createSessionCookie`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
        validDuration: String(SESSION_COOKIE_EXPIRY_SECONDS),
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to create session cookie: ${details}`)
  }

  const data = (await response.json()) as { sessionCookie?: string }
  return typeof data.sessionCookie === "string" ? data.sessionCookie : null
}

export async function verifySessionCookieValue(
  sessionCookie: string,
  mode: SessionVerificationMode = "strict",
): Promise<SessionVerificationResult> {
  const localResult = await verifySessionCookieLocally(sessionCookie)

  if (!isSessionVerificationValid(localResult) || mode === "local") {
    return localResult
  }

  try {
    const account = await lookupFirebaseAccount(localResult.claims.sub)

    if (!account) {
      return createSessionVerificationResult(
        "invalid",
        null,
        "Session account not found",
      )
    }

    if (account.disabled) {
      return createSessionVerificationResult(
        "invalid",
        null,
        "Session account is disabled",
      )
    }

    if (isSessionCookieRevoked(localResult.claims, account)) {
      return createSessionVerificationResult(
        "invalid",
        null,
        "Session cookie has been revoked",
      )
    }

    return createSessionVerificationResult(
      "valid",
      localResult.claims,
      null,
      account,
    )
  } catch (error) {
    return mapSessionVerificationError(error)
  }
}

async function verifySessionCookieLocally(
  sessionCookie: string,
): Promise<SessionVerificationResult> {
  try {
    const decoded = await decodeAndVerifySessionCookie(sessionCookie)
    return createSessionVerificationResult("valid", decoded)
  } catch (error) {
    return mapSessionVerificationError(error)
  }
}

export async function lookupFirebaseAccount(
  uid: string,
): Promise<FirebaseAccountInfo | null> {
  const config = getFirebaseServiceAccountConfig()

  if (!config) {
    throw new SessionVerificationError(
      "unavailable",
      "Firebase service account credentials are not configured",
    )
  }

  const accessToken = await getGoogleAccessToken()

  if (!accessToken) {
    throw new SessionVerificationError(
      "unavailable",
      "Google access token is unavailable",
    )
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        localId: [uid],
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new SessionVerificationError(
      "unavailable",
      `Failed to look up Firebase account: ${details}`,
    )
  }

  const data = (await response.json()) as {
    users?: FirebaseAccountInfo[]
  }

  return Array.isArray(data.users) ? (data.users[0] ?? null) : null
}

export function isSessionCookieRevoked(
  decodedClaims: DecodedSessionCookie,
  account: FirebaseAccountInfo,
): boolean {
  if (!account.validSince) {
    return false
  }

  const validSinceSeconds = Number.parseInt(account.validSince, 10)

  if (!Number.isFinite(validSinceSeconds)) {
    return false
  }

  return decodedClaims.auth_time < validSinceSeconds
}

export function getInvalidSessionCookieReason(
  payload: Record<string, unknown>,
  projectId: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  if (!projectId) {
    return "Missing Firebase project ID"
  }

  if (payload.aud !== projectId) {
    return "Invalid audience"
  }

  if (payload.iss !== `https://session.firebase.google.com/${projectId}`) {
    return "Invalid issuer"
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return "Invalid subject"
  }

  if (payload.sub.length > 128) {
    return "Invalid subject length"
  }

  if (typeof payload.auth_time !== "number") {
    return "Missing auth_time"
  }

  if (typeof payload.iat !== "number") {
    return "Missing iat"
  }

  if (typeof payload.exp !== "number") {
    return "Missing exp"
  }

  if (payload.exp <= nowSeconds) {
    return "Session cookie has expired"
  }

  return null
}

function createSessionVerificationResult(
  status: "valid",
  claims: DecodedSessionCookie,
  reason?: null,
  account?: FirebaseAccountInfo | null,
): SessionVerificationResult
function createSessionVerificationResult(
  status: Exclude<SessionVerificationStatus, "valid">,
  claims: null,
  reason: string,
): SessionVerificationResult
function createSessionVerificationResult(
  status: SessionVerificationStatus,
  claims: DecodedSessionCookie | null,
  reason: string | null = null,
  account: FirebaseAccountInfo | null = null,
): SessionVerificationResult {
  return {
    account,
    status,
    claims,
    reason,
  } as SessionVerificationResult
}

function mapSessionVerificationError(
  error: unknown,
): SessionVerificationResult {
  if (error instanceof SessionVerificationError) {
    return createSessionVerificationResult(error.status, null, error.message)
  }

  const reason = error instanceof Error ? error.message : "Unknown error"

  if (process.env.NODE_ENV !== "production") {
    console.warn("Session verification failed:", error)
  }

  return createSessionVerificationResult("unavailable", null, reason)
}

async function decodeAndVerifySessionCookie(
  sessionCookie: string,
): Promise<DecodedSessionCookie> {
  const projectId = getFirebaseProjectId()

  if (!projectId) {
    throw new SessionVerificationError(
      "unavailable",
      "Firebase project ID is not configured",
    )
  }

  const [encodedHeader, encodedPayload, encodedSignature] =
    sessionCookie.split(".")

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new SessionVerificationError(
      "invalid",
      "Session cookie is not a valid JWT",
    )
  }

  const header = parseJwtSegment(encodedHeader) as {
    alg?: string
    kid?: string
  }
  const payload = parseJwtSegment(encodedPayload) as Record<string, unknown>
  const validationError = getInvalidSessionCookieReason(payload, projectId)

  if (header.alg !== "RS256" || !header.kid) {
    throw new SessionVerificationError(
      "invalid",
      "Session cookie has an invalid header",
    )
  }

  if (validationError) {
    throw new SessionVerificationError("invalid", validationError)
  }

  const publicKey = await getImportedPublicKey(header.kid)
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    toArrayBuffer(decodeBase64Url(encodedSignature)),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!isValid) {
    throw new SessionVerificationError(
      "invalid",
      "Session cookie signature verification failed",
    )
  }

  return payload as DecodedSessionCookie
}

async function getImportedPublicKey(kid: string): Promise<CryptoKey> {
  const cachedKey = importedPublicKeys.get(kid)

  if (cachedKey) {
    return cachedKey
  }

  const jwk = await getPublicJwk(kid)
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  )

  importedPublicKeys.set(kid, publicKey)
  return publicKey
}

async function getPublicJwk(kid: string): Promise<FirebaseJwk> {
  const now = Date.now()

  if (jwksCache && jwksCache.expiresAt > now) {
    const cachedKey = jwksCache.keys.get(kid)
    if (cachedKey) {
      return cachedKey
    }
  }

  const staleCache = jwksCache

  try {
    jwksCache = await fetchPublicJwks()
  } catch (error) {
    const staleKey = staleCache?.keys.get(kid)

    if (staleKey) {
      jwksCache = staleCache
      return staleKey
    }

    throw error
  }

  const refreshedKey = jwksCache.keys.get(kid)

  if (!refreshedKey) {
    throw new SessionVerificationError(
      "invalid",
      `Unable to find Firebase public key for kid "${kid}"`,
    )
  }

  return refreshedKey
}

async function fetchPublicJwks(): Promise<JwksCache> {
  const response = await fetch(SESSION_COOKIE_JWKS_URL)

  if (!response.ok) {
    const details = await response.text()
    throw new SessionVerificationError(
      "unavailable",
      `Failed to fetch Firebase JWKS: ${details}`,
    )
  }

  const data = (await response.json()) as { keys?: FirebaseJwk[] }
  const cacheControl = response.headers.get("cache-control")
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/)
  const maxAgeSeconds = Number.parseInt(maxAgeMatch?.[1] ?? "3600", 10)

  if (!Array.isArray(data.keys)) {
    throw new SessionVerificationError(
      "unavailable",
      "Firebase JWKS response was missing keys",
    )
  }

  return {
    expiresAt: Date.now() + maxAgeSeconds * 1000,
    keys: new Map(
      data.keys
        .filter(
          (key): key is FirebaseJwk & { kid: string } =>
            typeof key.kid === "string",
        )
        .map((key) => [key.kid, key] as const),
    ),
  }
}

function parseJwtSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)))
}

function decodeBase64Url(segment: string): Uint8Array {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(`${normalized}${padding}`)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}
