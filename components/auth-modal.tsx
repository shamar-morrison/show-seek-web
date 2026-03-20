"use client"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { SHOWSEEK_ICON } from "@/lib/constants"
import {
  getCreateAccountErrorMessage,
  getEmailAuthErrorMessage,
  shouldOfferEmailAccountCreation,
  signInWithGoogle,
} from "@/lib/firebase/auth"
import {
  getFirebaseAuth,
  getFirebaseClientConfigErrorMessage,
} from "@/lib/firebase/config"
import { createUserDocument } from "@/lib/firebase/user"
import { cn } from "@/lib/utils"
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth"
import { useState } from "react"
import { z } from "zod"

/** Validation schema for sign-in form */
const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .pipe(z.string().min(6, "Password must be at least 6 characters")),
})

type SignInFormData = z.infer<typeof signInSchema>
type PendingEmailAccountCreation = {
  email: string
  password: string
}

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

function logAuthDebug(user: {
  email: string | null
  providerData: Array<{ providerId?: string | null }>
  uid: string
}) {
  if (process.env.NODE_ENV === "production") {
    return
  }

  const emailDomain = user.email?.split("@")[1] ?? null

  console.info("[AuthDebug] Signed in user", {
    emailDomain,
    providers: user.providerData.map((provider) => provider.providerId ?? null),
    uid: user.uid,
  })
}

/**
 * AuthModal Component
 * Single auth modal with Google auth and email/password form.
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
  /** Callback after auth and server session creation succeed */
  onAuthSuccess?: () => void | Promise<void>
  /** Optional message to display (e.g., "Sign in to rate movies") */
  message?: string
}

export function AuthModal({
  isOpen: controlledIsOpen,
  onClose,
  onAuthSuccess,
  message,
}: AuthModalProps = {}) {
  const { ensureServerSession, firebaseAvailable } = useAuth()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  })
  const [pendingEmailAccountCreation, setPendingEmailAccountCreation] =
    useState<PendingEmailAccountCreation | null>(null)
  const [errors, setErrors] = useState<Partial<SignInFormData>>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const shouldShowProviderGuidance =
    authError !== null &&
    authError
      .toLowerCase()
      .includes("same provider used for your premium mobile account")
  const firebaseUnavailableMessage = getFirebaseClientConfigErrorMessage()

  // Determine if we're in controlled mode
  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  /** Reset form state when modal closes or view changes */
  const resetForm = () => {
    setFormData({ email: "", password: "" })
    setPendingEmailAccountCreation(null)
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
    }
  }

  const handleAuthSuccess = async () => {
    if (onAuthSuccess) {
      await onAuthSuccess()
    }

    if (!isControlled || !onAuthSuccess) {
      handleOpenChange(false)
    }
  }

  /** Handle form input changes */
  const handleInputChange = (field: keyof SignInFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (pendingEmailAccountCreation) {
      setPendingEmailAccountCreation(null)
    }
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
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    if (!firebaseAvailable) {
      setAuthError(firebaseUnavailableMessage)
      return
    }

    setIsLoading(true)
    setAuthError(null)
    setPendingEmailAccountCreation(null)

    try {
      const auth = getFirebaseAuth()
      const userCredential = await signInWithEmailAndPassword(
        auth,
        result.data.email,
        result.data.password,
      )

      await completeAuth(userCredential.user)
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string }
      if (shouldOfferEmailAccountCreation(firebaseError.code)) {
        setPendingEmailAccountCreation({
          email: result.data.email,
          password: result.data.password,
        })
      } else {
        setAuthError(getEmailAuthErrorMessage(firebaseError))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const completeAuth = async (user: User) => {
    try {
      const userDocumentCreated = await createUserDocument(user)

      if (!userDocumentCreated) {
        setAuthError("We couldn't finish setting up your account. Please try again.")
        return
      }
    } catch (error) {
      console.error("Failed to create user document during auth completion:", error)
      setAuthError("We couldn't finish setting up your account. Please try again.")
      return
    }

    const sessionSyncResult = await ensureServerSession(user)

    if (!sessionSyncResult.ok) {
      setAuthError(
        sessionSyncResult.error ??
          "We couldn't start your session. Please try again.",
      )
      return
    }

    logAuthDebug(user)

    await handleAuthSuccess()
  }

  const handleCreateAccount = async () => {
    if (!pendingEmailAccountCreation) {
      return
    }

    if (!firebaseAvailable) {
      setAuthError(firebaseUnavailableMessage)
      setPendingEmailAccountCreation(null)
      return
    }

    setIsLoading(true)
    setAuthError(null)

    try {
      const auth = getFirebaseAuth()
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        pendingEmailAccountCreation.email,
        pendingEmailAccountCreation.password,
      )

      setPendingEmailAccountCreation(null)
      await completeAuth(userCredential.user)
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string }
      setPendingEmailAccountCreation(null)
      setAuthError(getCreateAccountErrorMessage(firebaseError))
    } finally {
      setIsLoading(false)
    }
  }

  /** Handle Google sign-in */
  const handleGoogleAuth = async () => {
    if (!firebaseAvailable) {
      setAuthError(firebaseUnavailableMessage)
      return
    }

    setIsGoogleLoading(true)
    setAuthError(null)

    try {
      const result = await signInWithGoogle()

      if (result.success) {
        await completeAuth(result.user)
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
            {message ? message : "Sign in to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Auth Error Display */}
          {authError && (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {authError}
            </div>
          )}
          {!firebaseAvailable && !authError && (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {firebaseUnavailableMessage}
            </div>
          )}
          {shouldShowProviderGuidance && (
            <div className="rounded-md bg-primary/10 p-3 text-center text-xs text-primary">
              Sign in with the same provider used on mobile to restore premium.
            </div>
          )}

          {/* Google Auth Button */}
          <Button
            type="button"
            variant={"outline"}
            onClick={handleGoogleAuth}
            disabled={!firebaseAvailable || isGoogleLoading || isLoading}
            className="w-full gap-3 text-white"
          >
            {isGoogleLoading ? (
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <GoogleLogo />
            )}
            Continue with Google
          </Button>

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
                disabled={!firebaseAvailable || isLoading || isGoogleLoading}
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
                  disabled={!firebaseAvailable || isLoading || isGoogleLoading}
                  className={cn(
                    "pr-10",
                    errors.password &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!firebaseAvailable || isLoading || isGoogleLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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

            <Button
              type="submit"
              className="w-full"
              disabled={!firebaseAvailable || isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Continue with email"
              )}
            </Button>
          </form>
        </div>
      </DialogContent>

      <AlertDialog
        open={pendingEmailAccountCreation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingEmailAccountCreation(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create an account?</AlertDialogTitle>
            <AlertDialogDescription>
              We couldn&apos;t find an account for{" "}
              {pendingEmailAccountCreation?.email ?? "this email"}. Create one
              with these credentials?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateAccount} disabled={isLoading}>
              {isLoading ? (
                <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Create account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
