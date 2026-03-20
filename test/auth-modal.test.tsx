import type { ButtonHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "./utils"

const authInstance = { name: "firebase-auth-instance" }

const {
  createUserDocumentMock,
  createUserWithEmailAndPasswordMock,
  ensureServerSessionMock,
  getFirebaseAuthMock,
  signInWithEmailAndPasswordMock,
  signInWithGoogleMock,
  useAuthMock,
} = vi.hoisted(() => ({
  createUserDocumentMock: vi.fn(),
  createUserWithEmailAndPasswordMock: vi.fn(),
  ensureServerSessionMock: vi.fn(),
  getFirebaseAuthMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
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

    return "Unable to create your account. Please try again."
  }),
  getEmailAuthErrorMessage: vi.fn((error: { code?: string }) => {
    if (error.code === "auth/wrong-password") {
      return "Invalid email or password. Please check your credentials."
    }

    return "Unable to sign in. Please try again."
  }),
  shouldOfferEmailAccountCreation: vi.fn(
    (code?: string) =>
      code === "auth/user-not-found" || code === "auth/invalid-credential",
  ),
  signInWithGoogle: signInWithGoogleMock,
}))

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open?: boolean
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open?: boolean
  }) => (open ? <div data-testid="create-account-dialog">{children}</div> : null),
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
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}))

import { AuthModal } from "../components/auth-modal"

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      ensureServerSession: ensureServerSessionMock,
      firebaseAvailable: true,
    })

    ensureServerSessionMock.mockResolvedValue({
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

  it("renders the single auth flow without sign-up controls", () => {
    render(<AuthModal isOpen />)

    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Sign up" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Don't have an account?"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Sign up with Google")).not.toBeInTheDocument()
  })

  it("signs in with email and completes auth setup in sequence", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    await waitFor(() => {
      expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
        authInstance,
        "user@example.com",
        "secret123",
      )
    })

    await waitFor(() => {
      expect(createUserDocumentMock).toHaveBeenCalledWith(signedInUser)
      expect(ensureServerSessionMock).toHaveBeenCalledWith(signedInUser)
      expect(onAuthSuccess).toHaveBeenCalledTimes(1)
    })

    expect(
      createUserDocumentMock.mock.invocationCallOrder[0],
    ).toBeGreaterThan(signInWithEmailAndPasswordMock.mock.invocationCallOrder[0])
    expect(
      ensureServerSessionMock.mock.invocationCallOrder[0],
    ).toBeGreaterThan(createUserDocumentMock.mock.invocationCallOrder[0])
  })

  it("shows an auth error and stops when user document creation returns false", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    createUserDocumentMock.mockResolvedValue(false)
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "We couldn't finish setting up your account. Please try again.",
      ),
    ).toBeInTheDocument()
    expect(ensureServerSessionMock).not.toHaveBeenCalled()
    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it("shows an auth error and stops when user document creation throws", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    createUserDocumentMock.mockRejectedValue(new Error("firestore down"))
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "We couldn't finish setting up your account. Please try again.",
      ),
    ).toBeInTheDocument()
    expect(ensureServerSessionMock).not.toHaveBeenCalled()
    expect(onAuthSuccess).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      "Failed to create user document during auth completion:",
      expect.any(Error),
    )
  })

  it("shows the session fallback message when server session sync returns not ok", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    ensureServerSessionMock.mockResolvedValue({
      error: null,
      ok: false,
      status: "error",
      uid: "user-1",
    })
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText("We couldn't start your session. Please try again."),
    ).toBeInTheDocument()
    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it("shows an auth error when server session sync throws", async () => {
    const onAuthSuccess = vi.fn()
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    ensureServerSessionMock.mockRejectedValue(new Error("session sync exploded"))
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText("We couldn't start your session. Please try again."),
    ).toBeInTheDocument()
    expect(onAuthSuccess).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      "Failed to ensure server session during auth completion:",
      expect.any(Error),
    )
  })

  it("shows an auth error when auth success handling throws", async () => {
    const onAuthSuccess = vi.fn().mockRejectedValue(new Error("callback failed"))
    const signedInUser = {
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "user-1",
    }

    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: signedInUser,
    })

    render(<AuthModal isOpen onAuthSuccess={onAuthSuccess} />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "We couldn't finish setting up your account. Please try again.",
      ),
    ).toBeInTheDocument()
    expect(onAuthSuccess).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to finalize auth completion:",
      expect.any(Error),
    )
  })

  it("prompts to create an account when sign-in fails for a missing email account", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/user-not-found",
    })

    render(<AuthModal isOpen />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "  new-user@example.com  " },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    await waitFor(() => {
      expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
        authInstance,
        "new-user@example.com",
        "secret123",
      )
    })

    expect(
      await screen.findByText("Create an account?"),
    ).toBeInTheDocument()
    expect(createUserWithEmailAndPasswordMock).not.toHaveBeenCalled()
  })

  it("uses the same create-account prompt for invalid-credential responses", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/invalid-credential",
    })

    render(<AuthModal isOpen />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "brand-new@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText("Create an account?"),
    ).toBeInTheDocument()
    expect(createUserWithEmailAndPasswordMock).not.toHaveBeenCalled()
  })

  it("creates the account after confirmation and completes auth setup", async () => {
    const createdUser = {
      email: "new-user@example.com",
      providerData: [{ providerId: "password" }],
      uid: "new-user",
    }

    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/user-not-found",
    })
    createUserWithEmailAndPasswordMock.mockResolvedValue({
      user: createdUser,
    })

    render(<AuthModal isOpen />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "new-user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    const createAccountButton = await screen.findByRole("button", {
      name: "Create account",
    })
    fireEvent.click(createAccountButton)

    await waitFor(() => {
      expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledWith(
        authInstance,
        "new-user@example.com",
        "secret123",
      )
    })

    await waitFor(() => {
      expect(createUserDocumentMock).toHaveBeenCalledWith(createdUser)
      expect(ensureServerSessionMock).toHaveBeenCalledWith(createdUser)
    })
  })

  it("shows the regular auth error and no create-account prompt for wrong passwords", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/wrong-password",
    })

    render(<AuthModal isOpen />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))

    expect(
      await screen.findByText(
        "Invalid email or password. Please check your credentials.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("create-account-dialog")).not.toBeInTheDocument()
    expect(createUserWithEmailAndPasswordMock).not.toHaveBeenCalled()
  })

  it("shows the create-account failure message when account creation is rejected", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/user-not-found",
    })
    createUserWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/email-already-in-use",
    })

    render(<AuthModal isOpen />)

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Create account" }),
    )

    expect(
      await screen.findByText(
        "An account with this email already exists. Try signing in again or use the original sign-in method.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("create-account-dialog")).not.toBeInTheDocument()
    expect(createUserDocumentMock).not.toHaveBeenCalled()
  })
})
