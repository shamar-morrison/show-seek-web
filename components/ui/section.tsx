import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface SectionProps {
  /** Section title displayed in the header */
  title: string
  /** Additional content to render in the header (e.g., ViewAllLink, count badge) */
  headerExtra?: ReactNode
  /** Section content */
  children: ReactNode
  /** Additional className for the section element */
  className?: string
  /** Ref to pass to the section element */
  sectionRef?: React.RefObject<HTMLElement | null>
}

/**
 * Section Component
 * Standardized container with header and content layout.
 * Uses max-w-[1800px] container with responsive padding.
 */
export function Section({
  title,
  headerExtra,
  children,
  className,
  sectionRef,
}: SectionProps) {
  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className={cn("py-8", className)}
    >
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {headerExtra}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {children}
      </div>
    </section>
  )
}
