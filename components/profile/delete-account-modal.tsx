"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { deleteUserAccount } from "@/lib/firebase/delete-account"
import { Dialog } from "@base-ui/react/dialog"
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface DeleteAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = "warning" | "reauth" | "deleting"

export function DeleteAccountModal({
  open,
  onOpenChange,
}: DeleteAccountModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>("warning")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  function handleClose() {
    setStep("warning")
    setPassword("")
    setError("")
    onOpenChange(false)
  }

  async function handleReauth() {
    if (!user || !user.email) return

    setError("")
    setIsDeleting(true)

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, credential)

      // Proceed to deletion
      setStep("deleting")
      await deleteUserAccount(user)

      toast.success("Account deleted successfully")
      handleClose()
      router.push("/")
    } catch (err) {
      console.error("Deletion error:", err)
      const errorCode = (err as { code?: string }).code

      if (errorCode === "auth/wrong-password") {
        setError("Incorrect password. Please try again.")
      } else if (errorCode === "auth/invalid-credential") {
        setError("Invalid credentials. Please try again.")
      } else if (errorCode === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.")
      } else {
        setError("An error occurred. Please try again.")
      }
      setStep("reauth")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#1a1a1a] p-6 shadow-xl data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-white">
              {step === "warning" && "Delete Account"}
              {step === "reauth" && "Confirm Your Identity"}
              {step === "deleting" && "Deleting Account..."}
            </Dialog.Title>
            {step !== "deleting" && (
              <Dialog.Close className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
              </Dialog.Close>
            )}
          </div>

          {step === "warning" && (
            <>
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  className="size-5 shrink-0 text-red-400"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-400">
                    This action is permanent
                  </p>
                  <p className="text-sm text-white/60">
                    All your data including ratings, watch lists, notes, and
                    preferences will be permanently deleted. This cannot be
                    undone.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => setStep("reauth")}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === "reauth" && (
            <>
              <Dialog.Description className="mt-2 text-sm text-white/60">
                Please enter your password to confirm account deletion.
              </Dialog.Description>

              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-white/80"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setStep("warning")}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReauth}
                  disabled={!password || isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete My Account"}
                </Button>
              </div>
            </>
          )}

          {step === "deleting" && (
            <div className="mt-6 flex flex-col items-center gap-4 py-8">
              <div className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-red-500" />
              <p className="text-sm text-white/60">
                Deleting your account and all associated data...
              </p>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
