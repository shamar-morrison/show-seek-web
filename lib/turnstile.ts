import "server-only"

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TURNSTILE_MAX_TOKEN_LENGTH = 2048

export const TURNSTILE_SECURITY_ERROR =
  "Security check failed. Please try again."

interface TurnstileSiteverifyResponse {
  success?: boolean
  "error-codes"?: string[]
  action?: string
  challenge_ts?: string
  hostname?: string
}

export function getTurnstileRemoteIp(headers: Headers): string | null {
  const cloudflareIp = headers.get("CF-Connecting-IP")?.trim()

  if (cloudflareIp) {
    return cloudflareIp
  }

  const forwardedFor = headers.get("X-Forwarded-For")
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim()

  return firstForwardedIp || null
}

export async function verifyTurnstileToken({
  remoteip,
  token,
}: {
  remoteip?: string | null
  token: unknown
}): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    console.error("Turnstile secret key is not configured.")
    return false
  }

  if (
    typeof token !== "string" ||
    token.trim() === "" ||
    token.length > TURNSTILE_MAX_TOKEN_LENGTH
  ) {
    return false
  }

  const body: {
    remoteip?: string
    response: string
    secret: string
  } = {
    secret,
    response: token,
  }

  if (remoteip) {
    body.remoteip = remoteip
  }

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error("Turnstile verification request failed:", response.status)
      return false
    }

    const result = (await response.json()) as TurnstileSiteverifyResponse

    return result.success === true
  } catch (error) {
    console.error("Turnstile verification failed:", error)
    return false
  }
}
