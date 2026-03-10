import "server-only"

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CLOUD_PLATFORM_SCOPE =
  "https://www.googleapis.com/auth/cloud-platform"
const ACCESS_TOKEN_SKEW_SECONDS = 60
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000

type CachedAccessToken = {
  accessToken: string
  expiresAt: number
}

type AccessTokenCache =
  | {
      kind: "resolved"
      value: CachedAccessToken
    }
  | {
      kind: "pending"
      value: Promise<CachedAccessToken>
    }

export interface FirebaseServiceAccountConfig {
  projectId: string
  clientEmail: string
  privateKey: string
}

let accessTokenCache: AccessTokenCache | null = null
const signingKeyCache = new Map<string, Promise<CryptoKey>>()

export function getFirebaseProjectId(): string | null {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    null
  )
}

export function getFirebaseServiceAccountConfig(): FirebaseServiceAccountConfig | null {
  const projectId = getFirebaseProjectId()
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  )

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

export function hasFirebaseServiceAccountConfig(): boolean {
  return getFirebaseServiceAccountConfig() !== null
}

export async function getGoogleAccessToken(): Promise<string | null> {
  const config = getFirebaseServiceAccountConfig()

  if (!config) {
    return null
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  if (accessTokenCache?.kind === "resolved" && accessTokenCache.value.expiresAt > nowSeconds) {
    return accessTokenCache.value.accessToken
  }

  if (accessTokenCache?.kind === "pending") {
    const cachedAccessToken = await accessTokenCache.value
    return cachedAccessToken.accessToken
  }

  const refreshPromise = refreshGoogleAccessToken(config)
  accessTokenCache = {
    kind: "pending",
    value: refreshPromise,
  }

  try {
    const cachedAccessToken = await refreshPromise
    accessTokenCache = {
      kind: "resolved",
      value: cachedAccessToken,
    }
    return cachedAccessToken.accessToken
  } catch (error) {
    if (
      accessTokenCache?.kind === "pending" &&
      accessTokenCache.value === refreshPromise
    ) {
      accessTokenCache = null
    }

    throw error
  }
}

async function refreshGoogleAccessToken(
  config: FirebaseServiceAccountConfig,
): Promise<CachedAccessToken> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const assertion = await createServiceAccountAssertion(config, nowSeconds)
  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort(),
    GOOGLE_REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Failed to fetch Google access token: ${details}`)
    }

    const data = (await response.json()) as {
      access_token?: string
      expires_in?: number
    }

    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new Error("Google access token response was missing required fields")
    }

    return {
      accessToken: data.access_token,
      expiresAt:
        nowSeconds + Math.max(data.expires_in - ACCESS_TOKEN_SKEW_SECONDS, 0),
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error("Google access token request timed out after 10000ms")
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function createServiceAccountAssertion(
  config: FirebaseServiceAccountConfig,
  nowSeconds: number,
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    scope: GOOGLE_CLOUD_PLATFORM_SCOPE,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }

  const encodedHeader = encodeJsonSegment(header)
  const encodedPayload = encodeJsonSegment(payload)
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const signingKey = await getSigningKey(config.privateKey)
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(unsignedToken),
  )

  return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`
}

async function getSigningKey(privateKey: string): Promise<CryptoKey> {
  const cacheKey = privateKey
  const cachedSigningKeyPromise = signingKeyCache.get(cacheKey)

  if (cachedSigningKeyPromise) {
    return cachedSigningKeyPromise
  }

  const signingKeyPromise = crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  ).catch((error) => {
    signingKeyCache.delete(cacheKey)
    throw error
  })

  signingKeyCache.set(cacheKey, signingKeyPromise)
  return signingKeyPromise
}

function encodeJsonSegment(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "")

  return base64ToArrayBuffer(normalized)
}

function base64ToArrayBuffer(base64Value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Value.length % 4)) % 4)
  const binary = atob(`${base64Value}${padding}`)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}
