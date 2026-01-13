"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BaseMediaModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Modal title */
  title: string
  /** Modal description (optional) */
  description?: string
  /** Max width class, defaults to "sm:max-w-md" */
  maxWidth?: string
  /** Modal content */
  children: React.ReactNode
}

/**
 * BaseMediaModal Component
 * Reusable wrapper providing common Dialog shell for media action modals
 */
export function BaseMediaModal({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = "sm:max-w-md",
  children,
}: BaseMediaModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
