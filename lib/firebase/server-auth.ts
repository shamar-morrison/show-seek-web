import {
  getGoogleAccessToken,
  getFirebaseServiceAccountConfig,
  hasFirebaseServiceAccountConfig,
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

type FirebaseJwk = JsonWebKey & {
  kid?: string
}

let jwksCache: JwksCache | null = null
const importedPublicKeys = new Map<string, CryptoKey>()

export { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }

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
        validDuration: `${SESSION_COOKIE_EXPIRY_SECONDS}s`,
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
  checkRevoked = true,
): Promise<DecodedSessionCookie | null> {
  if (!hasFirebaseServiceAccountConfig()) {
    return null
  }

  try {
    const decoded = await decodeAndVerifySessionCookie(sessionCookie)

    if (!checkRevoked) {
      return decoded
    }

    const account = await lookupFirebaseAccount(decoded.sub)

    if (!account || account.disabled) {
      return null
    }

    if (isSessionCookieRevoked(decoded, account)) {
      return null
    }

    return decoded
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Session verification failed:", error)
    }

    return null
  }
}

export async function lookupFirebaseAccount(
  uid: string,
): Promise<FirebaseAccountInfo | null> {
  const config = getFirebaseServiceAccountConfig()
  const accessToken = await getGoogleAccessToken()

  if (!config || !accessToken) {
    return null
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
    throw new Error(`Failed to look up Firebase account: ${details}`)
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
  projectId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
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

async function decodeAndVerifySessionCookie(
  sessionCookie: string,
): Promise<DecodedSessionCookie> {
  const config = getFirebaseServiceAccountConfig()

  if (!config) {
    throw new Error("Firebase service account credentials are not configured")
  }

  const [encodedHeader, encodedPayload, encodedSignature] =
    sessionCookie.split(".")

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Session cookie is not a valid JWT")
  }

  const header = parseJwtSegment(encodedHeader) as {
    alg?: string
    kid?: string
  }
  const payload = parseJwtSegment(encodedPayload) as Record<string, unknown>
  const validationError = getInvalidSessionCookieReason(
    payload,
    config.projectId,
  )

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Session cookie has an invalid header")
  }

  if (validationError) {
    throw new Error(validationError)
  }

  const publicKey = await getImportedPublicKey(header.kid)
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    toArrayBuffer(decodeBase64Url(encodedSignature)),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!isValid) {
    throw new Error("Session cookie signature verification failed")
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

  if (!jwksCache || jwksCache.expiresAt <= now) {
    jwksCache = await fetchPublicJwks()
  }

  const key = jwksCache.keys.get(kid)

  if (!key) {
    jwksCache = await fetchPublicJwks()
    const refreshedKey = jwksCache.keys.get(kid)

    if (!refreshedKey) {
      throw new Error(`Unable to find Firebase public key for kid "${kid}"`)
    }

    return refreshedKey
  }

  return key
}

async function fetchPublicJwks(): Promise<JwksCache> {
  const response = await fetch(SESSION_COOKIE_JWKS_URL)

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to fetch Firebase JWKS: ${details}`)
  }

  const data = (await response.json()) as { keys?: FirebaseJwk[] }
  const cacheControl = response.headers.get("cache-control")
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/)
  const maxAgeSeconds = Number.parseInt(maxAgeMatch?.[1] ?? "3600", 10)

  if (!Array.isArray(data.keys)) {
    throw new Error("Firebase JWKS response was missing keys")
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
