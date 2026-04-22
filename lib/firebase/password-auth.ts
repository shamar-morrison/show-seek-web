import "server-only"

import { createFirebaseCustomToken } from "./server-api"

const IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1"
const FIREBASE_PASSWORD_AUTH_TIMEOUT_MS = 10_000

export type FirebasePasswordAuthOperation = "login" | "signup"

export interface FirebasePasswordAuthResult {
  customToken: string
  idToken: string
  uid: string
}

export class FirebasePasswordAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "FirebasePasswordAuthError"
  }
}

interface IdentityToolkitPasswordAuthResponse {
  idToken?: string
  localId?: string
}

interface IdentityToolkitErrorResponse {
  error?: {
    message?: string
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function getFirebaseWebApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()

  if (!apiKey) {
    throw new FirebasePasswordAuthError(
      "auth/configuration-not-found",
      "Authentication service temporarily unavailable",
      503,
    )
  }

  return apiKey
}

function getEndpoint(operation: FirebasePasswordAuthOperation): string {
  return operation === "login"
    ? "accounts:signInWithPassword"
    : "accounts:signUp"
}

function normalizeIdentityToolkitMessage(message: string | undefined): string {
  return (message ?? "UNKNOWN_ERROR").split(" : ")[0]?.trim() || "UNKNOWN_ERROR"
}

function mapIdentityToolkitError(
  operation: FirebasePasswordAuthOperation,
  message: string | undefined,
): FirebasePasswordAuthError {
  const normalizedMessage = normalizeIdentityToolkitMessage(message)

  switch (normalizedMessage) {
    case "EMAIL_NOT_FOUND":
      return new FirebasePasswordAuthError(
        "auth/user-not-found",
        "Invalid email or password. Please check your credentials.",
        401,
      )
    case "INVALID_PASSWORD":
      return new FirebasePasswordAuthError(
        "auth/wrong-password",
        "Invalid email or password. Please check your credentials.",
        401,
      )
    case "INVALID_LOGIN_CREDENTIALS":
      return new FirebasePasswordAuthError(
        "auth/invalid-credential",
        "Invalid email or password. Please check your credentials.",
        401,
      )
    case "USER_DISABLED":
      return new FirebasePasswordAuthError(
        "auth/user-disabled",
        "This account has been disabled. Please contact support.",
        403,
      )
    case "EMAIL_EXISTS":
      return new FirebasePasswordAuthError(
        "auth/email-already-in-use",
        "An account with this email already exists. Try signing in again or use the original sign-in method.",
        409,
      )
    case "WEAK_PASSWORD":
      return new FirebasePasswordAuthError(
        "auth/weak-password",
        "Password must be at least 6 characters.",
        400,
      )
    case "INVALID_EMAIL":
      return new FirebasePasswordAuthError(
        "auth/invalid-email",
        "Please enter a valid email address.",
        400,
      )
    case "OPERATION_NOT_ALLOWED":
      return new FirebasePasswordAuthError(
        "auth/operation-not-allowed",
        operation === "login"
          ? "Email/password sign-in is not enabled. Please contact support."
          : "Email/password account creation is not enabled. Please contact support.",
        403,
      )
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return new FirebasePasswordAuthError(
        "auth/too-many-requests",
        "Too many attempts. Please try again later.",
        429,
      )
    default:
      return new FirebasePasswordAuthError(
        "auth/internal-error",
        "Authentication service temporarily unavailable",
        503,
      )
  }
}

async function fetchIdentityToolkitPasswordAuth({
  email,
  operation,
  password,
}: {
  email: string
  operation: FirebasePasswordAuthOperation
  password: string
}): Promise<IdentityToolkitPasswordAuthResponse> {
  const apiKey = getFirebaseWebApiKey()
  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort(),
    FIREBASE_PASSWORD_AUTH_TIMEOUT_MS,
  )

  try {
    const response = await fetch(
      `${IDENTITY_TOOLKIT_BASE_URL}/${getEndpoint(operation)}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
        signal: abortController.signal,
      },
    )

    if (!response.ok) {
      const details = (await response
        .json()
        .catch(() => ({}))) as IdentityToolkitErrorResponse

      throw mapIdentityToolkitError(operation, details.error?.message)
    }

    return (await response.json()) as IdentityToolkitPasswordAuthResponse
  } catch (error) {
    if (error instanceof FirebasePasswordAuthError) {
      throw error
    }

    if (abortController.signal.aborted || isAbortError(error)) {
      throw new FirebasePasswordAuthError(
        "auth/network-request-failed",
        "Authentication service temporarily unavailable",
        503,
      )
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function authenticateWithEmailAndPassword({
  email,
  operation,
  password,
}: {
  email: string
  operation: FirebasePasswordAuthOperation
  password: string
}): Promise<FirebasePasswordAuthResult> {
  const authResponse = await fetchIdentityToolkitPasswordAuth({
    email,
    operation,
    password,
  })

  if (!authResponse.idToken || !authResponse.localId) {
    throw new FirebasePasswordAuthError(
      "auth/internal-error",
      "Authentication service temporarily unavailable",
      503,
    )
  }

  const customToken = await createFirebaseCustomToken(authResponse.localId)

  return {
    customToken,
    idToken: authResponse.idToken,
    uid: authResponse.localId,
  }
}
