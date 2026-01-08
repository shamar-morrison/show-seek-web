"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PremiumModal({ open, onOpenChange }: PremiumModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md border-amber-500/20 bg-black">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/20 to-transparent" />

        <div className="relative flex flex-col items-center p-8 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/50">
            <HugeiconsIcon icon={CrownIcon} className="size-8 text-amber-500" />
          </div>

          <DialogHeader className="mb-6 space-y-2">
            <DialogTitle className="text-2xl font-bold text-white">
              Unlock Premium
            </DialogTitle>
            <DialogDescription className="text-base text-white/70">
              This exclusive feature is available for Premium members. You can
              upgrade on our mobile app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 w-full flex flex-col items-center">
            <Link
              href="https://play.google.com/store/apps/details?id=app.horizon.showseek"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-105 active:scale-95"
            >
              <Image
                src="/google_play.png"
                alt="Get it on Google Play"
                width={200}
                height={59}
                className="h-auto w-[200px]"
                priority
              />
            </Link>

            <p className="text-xs text-white/40 max-w-[250px]">
              * This is a temporary web limitation. Full web support is coming
              soon.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
