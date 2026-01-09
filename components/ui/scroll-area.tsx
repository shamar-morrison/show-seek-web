"use client"

import { cn } from "@/lib/utils"
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area"

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  viewportClassName?: string
}

export function ScrollArea({
  children,
  className,
  viewportClassName,
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={cn("relative", className)}>
      <BaseScrollArea.Viewport
        className={cn("size-full overscroll-contain", viewportClassName)}
      >
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        orientation="vertical"
        className="flex h-full w-2 justify-center rounded-full bg-white/5 opacity-0 transition-opacity hover:bg-white/10 data-scrolling:opacity-100 data-hovering:opacity-100"
      >
        <BaseScrollArea.Thumb className="w-full rounded-full bg-white/30" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
}
