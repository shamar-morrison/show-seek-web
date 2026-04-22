import type { ButtonHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "./utils"

const authInstance = { name: "firebase-auth-instance" }

const {
  createUserDocumentMock,
  ensureServerSessionMock,
  getFirebaseAuthMock,
  markServerSessionReadyMock,
  signInWithCustomTokenMock,
  signInWithGoogleMock,
  useAuthMock,
} = vi.hoisted(() => ({
  createUserDocumentMock: vi.fn(),
  ensureServerSessionMock: vi.fn(),
  getFirebaseAuthMock: vi.fn(),
  markServerSessionReadyMock: vi.fn(),
  signInWithCustomTokenMock: vi.fn(),
  signInWithGoogleMock: vi.fn(),
  useAuthMock: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
  getFirebaseClientConfigErrorMessage: vi.fn(
    () => "Firebase client configuration is unavailable.",
  ),
}))

vi.mock("@/lib/firebase/user", () => ({
  createUserDocument: createUserDocumentMock,
}))

vi.mock("@/lib/firebase/auth", () => ({
  getCreateAccountErrorMessage: vi.fn((error: { code?: string }) => {
    if (error.code === "auth/email-already-in-use") {
      return "An account with this email already exists. Try signing in again or use the original sign-in method."
    }

    return error instanceof Error
      ? error.message
      : "Unable to create your account. Please try again."
  }),
  getEmailAuthErrorMessage: vi.fn(
    (error: { code?: string; message?: string }) => {
      if (error.code === "auth/wrong-password") {
        return "Invalid email or password. Please check your credentials."
      }

      return error.message || "Unable to sign in. Please try again."
    },
  ),
  shouldOfferEmailAccountCreation: vi.fn(
    (code?: string) =>
      code === "auth/user-not-found" || code === "auth/invalid-credential",
  ),
  signInWithGoogle: signInWithGoogleMock,
}))

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: signInWithCustomTokenMock,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="create-account-dialog">{children}</div> : null,
  AlertDialogAction: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h3>{children}</h3>
  ),
}))

import { AuthModal } from "../components/auth-modal"

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function createTurnstileMock({ issueToken = true } = {}) {
  const turnstile = {
    remove: vi.fn(),
    render: vi.fn(
      (
        _container: HTMLElement | string,
        options: {
          action?: string
          callback?: (token: string) => void
        },
      ) => {
        if (issueToken) {
          options.callback?.(`${options.action ?? "auth"}-turnstile-token`)
        }

        return `${options.action ?? "auth"}-widget`
      },
    ),
    reset: vi.fn(),
  }

  return turnstile
}

function setWindowTurnstile(turnstile: unknown) {
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    value: turnstile,
  })
}

function installTurnstileMock(
  options?: Parameters<typeof createTurnstileMock>[0],
) {
  const turnstile = createTurnstileMock(options)

  setWindowTurnstile(turnstile)

  return turnstile
}

function appendTurnstileScript() {
  const script = document.createElement("script")

  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
  script.dataset.testTurnstileScript = "true"
  document.head.appendChild(script)

  return script
}

async function waitForTurnstileToken(
  container: HTMLElement,
  token: string,
): Promise<void> {
  await waitFor(() => {
    const tokenInput = container.querySelector<HTMLInputElement>(
      'input[name="cf-turnstile-response"]',
    )

    expect(tokenInput?.value).toBe(token)
  })
}

function fillEmailForm(email = "user@example.com", password = "secret123") {
  fireEvent.change(screen.getByPlaceholderText("Email address"), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText("Password"), {
    target: { value: password },
  })
}

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key")
    document.head
      .querySelectorAll("[data-test-turnstile-script]")
      .forEach((script) => script.remove())
    installTurnstileMock()

    useAuthMock.mockReturnValue({
      ensureServerSession: ensureServerSessionMock,
      firebaseAvailable: true,
      markServerSessionReady: markServerSessionReadyMock,
    })

    ensureServerSessionMock.mockResolvedValue({
      error: null,
      ok: true,
      status: "ready",
      uid: "user-1",
    })
    markServerSessionReadyMock.mockResolvedValue({
      error: null,
      ok: true,
      status: "ready",
      uid: "user-1",
    })

    createUserDocumentMock.mockResolvedValue(true)
    getFirebaseAuthMock.mockReturnValue(authInstance)

    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("renders the email auth form with a Turnstile widget", async () => {
    const turnstile = window.turnstile as ReturnType<
      typeof installTurnstileMock
    >
    const { container } = render(<AuthModal isOpen />)

    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeInTheDocument()
    expect(container.querySelector('[id^="turnstile-"]')).toBeInTheDocument()
    await waitForTurnstileToken(container, "login-turnstile-token")
    expect(turnstile.render).toHaveBeenCalledWith(
      expect.stringMatching(/^#turnstile-/),
      expect.objectContaining({
        action: "login",
        "response-field": false,
        sitekey: "test-site-key",
      }),
    )
  })

  it("waits for the Turnstile script API before rendering", async () => {
    const turnstile = createTurnstileMock()
    const script = appendTurnstileScript()

    setWindowTurnstile(undefined)

    const { container } = render(<AuthModal isOpen />)

    expect(turnstile.render).not.toHaveBeenCalled()

    setWindowTurnstile(turnstile)
    script.dispatchEvent(new Event("load"))

    await waitFor(() => {
      expect(turnstile.render).toHaveBeenCalledWith(
        expect.stringMatching(/^#turnstile-/),
        expect.objectContaining({ action: "login" }),
      )
    })
    await waitForTurnstileToken(container, "login-turnstile-token")
  })

  it("removes the old widget and renders a fresh one when reopened", async () => {
    const turnstile = window.turnstile as ReturnType<
      typeof installTurnstileMock
    >
    const { rerender } = render(<AuthModal isOpen />)

    await waitFor(() => {
      expect(turnstile.render).toHaveBeenCalledTimes(1)
    })

    rerender(<AuthModal isOpen={false} />)

    await waitFor(() => {
      expect(turnstile.remove).toHaveBeenCalledWith("login-widget")
    })

    rerender(<AuthModal isOpen />)

    await waitFor(() => {
      expect(turnstile.render).toHaveBeenCalledTimes(2)
    })
  })

  it("posts email login with the Turnstile token and completes auth setup", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      getIdToken: vi.fn(async () => "client-id-token"),
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }
    const fetchMock = vi.fn(async () =>
      jsonResponse({ customToken: "custom-token", uid: "user-1" }),
    )

    vi.stubGlobal("fetch", fetchMock)
    signInWithCustomTokenMock.mockResolvedValue({ user: signedInUser })

    const { container } = render(
      <AuthModal isOpen onAuthSuccess={onAuthSuccess} />,
    )
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm()

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          body: JSON.stringify({
            email: "user@example.com",
            password: "secret123",
            turnstileToken: "login-turnstile-token",
          }),
          credentials: "same-origin",
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(signInWithCustomTokenMock).toHaveBeenCalledWith(
        authInstance,
        "custom-token",
      )
      expect(createUserDocumentMock).toHaveBeenCalledWith(signedInUser)
      expect(markServerSessionReadyMock).toHaveBeenCalledWith(signedInUser)
      expect(ensureServerSessionMock).not.toHaveBeenCalled()
      expect(onAuthSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it("prompts to create an account when server login reports invalid credentials", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          code: "auth/invalid-credential",
          error: "Invalid email or password. Please check your credentials.",
        },
        401,
      ),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(<AuthModal isOpen />)
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm("new-user@example.com")

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(await screen.findByText("Create an account?")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled()
  })

  it("creates the account after confirmation with a fresh signup Turnstile token", async () => {
    const createdUser = {
      email: "new-user@example.com",
      getIdToken: vi.fn(async () => "client-id-token"),
      providerData: [{ providerId: "password" }],
      uid: "new-user",
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: "auth/invalid-credential",
            error: "Invalid email or password. Please check your credentials.",
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ customToken: "signup-custom-token", uid: "new-user" }),
      )

    vi.stubGlobal("fetch", fetchMock)
    signInWithCustomTokenMock.mockResolvedValue({ user: createdUser })

    const { container } = render(<AuthModal isOpen />)
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm("new-user@example.com")

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    const createAccountButton = await screen.findByRole("button", {
      name: "Create account",
    })

    await waitFor(() => {
      const tokenInputs = container.querySelectorAll<HTMLInputElement>(
        'input[name="cf-turnstile-response"]',
      )
      expect(
        Array.from(tokenInputs).some(
          (input) => input.value === "signup-turnstile-token",
        ),
      ).toBe(true)
    })

    fireEvent.click(createAccountButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/auth/signup",
        expect.objectContaining({
          body: JSON.stringify({
            email: "new-user@example.com",
            password: "secret123",
            turnstileToken: "signup-turnstile-token",
          }),
          credentials: "same-origin",
          method: "POST",
        }),
      )
    })

    await waitFor(() => {
      expect(signInWithCustomTokenMock).toHaveBeenCalledWith(
        authInstance,
        "signup-custom-token",
      )
      expect(createUserDocumentMock).toHaveBeenCalledWith(createdUser)
      expect(markServerSessionReadyMock).toHaveBeenCalledWith(createdUser)
    })
  })

  it("shows regular auth errors without opening the create-account prompt", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          code: "auth/wrong-password",
          error: "Invalid email or password. Please check your credentials.",
        },
        401,
      ),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(<AuthModal isOpen />)
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm()

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "Invalid email or password. Please check your credentials.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("create-account-dialog"),
    ).not.toBeInTheDocument()
  })

  it("shows the Turnstile security failure returned by the server", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: "Security check failed. Please try again." }, 400),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(<AuthModal isOpen />)
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm()

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText("Security check failed. Please try again."),
    ).toBeInTheDocument()
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled()
  })

  it("blocks email login locally when the Turnstile token is empty", async () => {
    const turnstile = installTurnstileMock({ issueToken: false })
    const fetchMock = vi.fn()

    vi.stubGlobal("fetch", fetchMock)

    render(<AuthModal isOpen />)

    await waitFor(() => {
      expect(turnstile.render).toHaveBeenCalled()
    })
    fillEmailForm()

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText("Security check failed. Please try again."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(signInWithCustomTokenMock).not.toHaveBeenCalled()
  })

  it("shows an auth error and stops when user document creation returns false", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      getIdToken: vi.fn(async () => "client-id-token"),
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    createUserDocumentMock.mockResolvedValue(false)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ customToken: "custom-token", uid: "user-1" }),
      ),
    )
    signInWithCustomTokenMock.mockResolvedValue({ user: signedInUser })

    const { container } = render(
      <AuthModal isOpen onAuthSuccess={onAuthSuccess} />,
    )
    await waitForTurnstileToken(container, "login-turnstile-token")
    fillEmailForm()

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "We couldn't finish setting up your account. Please try again.",
      ),
    ).toBeInTheDocument()
    expect(markServerSessionReadyMock).not.toHaveBeenCalled()
    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it("keeps Google auth on the existing server-session sync path", async () => {
    const googleUser = {
      email: "user@example.com",
      providerData: [{ providerId: "google.com" }],
      uid: "user-1",
    }

    signInWithGoogleMock.mockResolvedValue({
      success: true,
      user: googleUser,
    })

    render(<AuthModal isOpen />)

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    )

    await waitFor(() => {
      expect(createUserDocumentMock).toHaveBeenCalledWith(googleUser)
      expect(ensureServerSessionMock).toHaveBeenCalledWith(googleUser)
      expect(markServerSessionReadyMock).not.toHaveBeenCalled()
    })
  })
})
