"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SHOWSEEK_ICON } from "@/lib/constants"
import { getEmailAuthErrorMessage, signInWithGoogle } from "@/lib/firebase/auth"
import { auth } from "@/lib/firebase/config"
import { createUserDocument } from "@/lib/firebase/user"
import { cn } from "@/lib/utils"
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useState } from "react"
import { z } from "zod"

/** Validation schema for sign-in form */
const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type SignInFormData = z.infer<typeof signInSchema>

/** Google Logo SVG Component */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * Create a server-side session after successful sign-in
 */
async function createServerSession(idToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    let errorDetail = ""
    try {
      const data = await response.json()
      errorDetail = data.error || data.message || JSON.stringify(data)
    } catch {
      try {
        errorDetail = await response.text()
      } catch {
        errorDetail = "Unknown session creation error"
      }
    }
    throw new Error(
      `Session creation failed (Status ${response.status}): ${errorDetail}`,
    )
  }
}

/**
 * AuthModal Component
 * Sign-in/Sign-up modal with Google auth and email/password form
 * Supports switching between sign-in and sign-up views
 *
 * Can be used in two modes:
 * 1. Trigger mode (default): Renders a "Sign In" button that opens the modal
 * 2. Controlled mode: Pass isOpen/onClose props to control the modal externally
 */
interface AuthModalProps {
  /** Controlled mode: whether the modal is open */
  isOpen?: boolean
  /** Controlled mode: callback when modal should close */
  onClose?: () => void
  /** Optional message to display (e.g., "Sign in to rate movies") */
  message?: string
}

export function AuthModal({
  isOpen: controlledIsOpen,
  onClose,
  message,
}: AuthModalProps = {}) {
  const [view, setView] = useState<"sign-in" | "sign-up">("sign-in")
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  })
  const [errors, setErrors] = useState<Partial<SignInFormData>>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // Determine if we're in controlled mode
  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  /** Reset form state when modal closes or view changes */
  const resetForm = () => {
    setFormData({ email: "", password: "" })
    setErrors({})
    setAuthError(null)
    setShowPassword(false)
  }

  /** Handle modal open state change */
  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      if (!open && onClose) {
        onClose()
      }
    } else {
      setInternalIsOpen(open)
    }
    if (!open) {
      resetForm()
      setView("sign-in")
    }
  }

  /** Switch between sign-in and sign-up views */
  const switchView = (newView: "sign-in" | "sign-up") => {
    resetForm()
    setView(newView)
  }

  /** Handle form input changes */
  const handleInputChange = (field: keyof SignInFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    if (authError) {
      setAuthError(null)
    }
  }

  /** Handle email/password sign-in form submission */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form data
    const result = signInSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Partial<SignInFormData> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignInFormData
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)
    setAuthError(null)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        result.data.email,
        result.data.password,
      )

      // Sync Firestore user document
      await createUserDocument(userCredential.user)

      // Create server-side session
      const idToken = await userCredential.user.getIdToken()
      await createServerSession(idToken)

      handleOpenChange(false)
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string }
      setAuthError(getEmailAuthErrorMessage(firebaseError))
    } finally {
      setIsLoading(false)
    }
  }

  /** Handle Google sign-in/sign-up */
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true)
    setAuthError(null)

    try {
      const result = await signInWithGoogle()

      if (result.success) {
        // Create user document in Firestore
        await createUserDocument(result.user)

        // Get the ID token and create a server-side session
        const idToken = await result.user.getIdToken()
        await createServerSession(idToken)

        handleOpenChange(false)
      } else if (!result.cancelled && result.error) {
        setAuthError(result.error)
      }
    } catch (error) {
      console.error("Google auth error:", error)
      const errorMessage =
        (error as Error)?.message ||
        "An unexpected error occurred. Please try again."
      setAuthError(errorMessage)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Only show trigger button in uncontrolled mode */}
      {!isControlled && (
        <DialogTrigger
          render={
            <Button className="bg-primary px-5 font-semibold text-white transition-all hover:bg-primary/80" />
          }
        >
          Sign In
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[400px]" showCloseButton>
        <DialogHeader className="items-center text-center">
          {/* Logo */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <HugeiconsIcon icon={SHOWSEEK_ICON} className="size-8 text-white" />
          </div>

          {/* App Name */}
          <DialogTitle className="text-2xl font-bold">ShowSeek</DialogTitle>

          {/* Subtitle - show custom message if provided */}
          <DialogDescription>
            {message
              ? message
              : view === "sign-in"
                ? "Sign in to continue."
                : "Create your account."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Auth Error Display */}
          {authError && (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {authError}
            </div>
          )}

          {/* Google Auth Button */}
          <Button
            type="button"
            variant={"outline"}
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading || isLoading}
            className="w-full gap-3 text-white"
          >
            {isGoogleLoading ? (
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <GoogleLogo />
            )}
            {view === "sign-in" ? "Sign in with Google" : "Sign up with Google"}
          </Button>

          {/* Only show email/password form for sign-in view */}
          {view === "sign-in" && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  OR
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleSignIn} className="flex flex-col gap-3">
                {/* Email Input */}
                <div className="flex flex-col gap-1.5">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={isLoading || isGoogleLoading}
                    className={cn(
                      errors.email &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-xs text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      disabled={isLoading || isGoogleLoading}
                      className={cn(
                        "pr-10",
                        errors.password &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                      aria-invalid={!!errors.password}
                      aria-describedby={
                        errors.password ? "password-error" : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <HugeiconsIcon
                        icon={showPassword ? ViewOffIcon : ViewIcon}
                        className="size-4"
                      />
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-xs text-destructive">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isLoading ? (
                    <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </>
          )}

          {/* View Switch Link */}
          <p className="text-center text-sm text-muted-foreground">
            {view === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("sign-up")}
                  className="font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("sign-in")}
                  className="font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
