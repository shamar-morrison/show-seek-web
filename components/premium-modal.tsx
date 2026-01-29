"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  CrownIcon,
  Playlist01Icon,
  ViewOffIcon,
  FilterHorizontalIcon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PremiumModal({ open, onOpenChange }: PremiumModalProps) {
  const features = [
    {
      icon: Playlist01Icon,
      title: "Unlimited Custom Lists",
      description: "Create as many lists as you want.",
    },
    {
      icon: ViewOffIcon,
      title: "Hide Watched Content",
      description: "Automatically filter out what you've seen.",
    },
    {
      icon: FilterHorizontalIcon,
      title: "Advanced Filters",
      description: "Filter by watch providers like Netflix.",
    },
    {
      icon: StarIcon,
      title: "Exclusive Content",
      description: "Access premium-only lists and trailers.",
    },
    {
      icon: CrownIcon,
      title: "Premium Status",
      description: "Get the exclusive Crown badge.",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md border-amber-500/20 bg-black text-white">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/20 to-transparent" />

        <div className="relative flex flex-col items-center p-6 text-center">
          {/* Header Icon */}
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/50">
            <HugeiconsIcon icon={CrownIcon} className="size-6 text-amber-500" />
          </div>

          <DialogHeader className="mb-6 space-y-2">
            <DialogTitle className="text-2xl font-bold text-white">
              Upgrade to Premium
            </DialogTitle>
            <p className="text-sm text-white/70">
              Unlock the full potential of ShowSeek.
            </p>
          </DialogHeader>

          {/* Feature List */}
          <div className="w-full space-y-4 text-left mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 text-amber-500">
                  <HugeiconsIcon icon={feature.icon} className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-white/60">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="w-full">
            <Button
              asChild
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-full"
            >
              <Link
                href="https://showseek.app/upgrade-dummy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sounds Great, Let&apos;s go
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}