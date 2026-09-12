"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  RUNTIME_MAX,
  RUNTIME_MIN,
  RUNTIME_STEP,
  isFullRuntimeRange,
  type RuntimeRange,
} from "@/lib/discover-runtime"
import { formatRuntime } from "@/lib/format-helpers"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"

/** Debounce before committing slider changes (each commit re-runs Discover). */
const RUNTIME_COMMIT_DEBOUNCE_MS = 500

const FULL_RANGE: RuntimeRange = [RUNTIME_MIN, RUNTIME_MAX]

function rangeKey(range: RuntimeRange | null): string {
  return range ? `${range[0]}-${range[1]}` : "off"
}

function formatRangeLabel(range: RuntimeRange): string {
  const min = formatRuntime(range[0]) ?? `${range[0]}m`
  const max = formatRuntime(range[1]) ?? `${range[1]}m`
  return `${min} – ${max}`
}

interface RuntimeSliderFilterProps {
  /** Committed value from the URL; null = filter off */
  value: RuntimeRange | null
  /** Called (debounced) when the user settles on a new range */
  onCommit: (value: RuntimeRange | null) => void
  /** Optional hint shown in the popover (e.g. "per episode" for TV) */
  hint?: string
  /** Whether the control is disabled */
  disabled?: boolean
}

/**
 * RuntimeSliderFilter Component
 * Dual-thumb range slider in a popover for filtering Discover results
 * by runtime. The trigger matches the other filter buttons and shows
 * the selected range. Thumbs update instantly while dragging; the
 * committed value (which triggers a Discover refetch) is debounced to
 * avoid a navigation per tick, with a flush on popover close so a
 * pending drag is never dropped when the popup unmounts.
 */
export function RuntimeSliderFilter({
  value,
  onCommit,
  hint,
  disabled = false,
}: RuntimeSliderFilterProps) {
  const [open, setOpen] = useState(false)
  const [localRange, setLocalRange] = useState<RuntimeRange>(
    value ?? FULL_RANGE,
  )
  const [prevCommittedKey, setPrevCommittedKey] = useState(rangeKey(value))
  const debouncedRange = useDebouncedValue(
    localRange,
    RUNTIME_COMMIT_DEBOUNCE_MS,
  )
  const onCommitRef = useRef(onCommit)
  const localRangeRef = useRef(localRange)
  const committedKeyRef = useRef(rangeKey(value))
  const lastSentKeyRef = useRef<string | null>(null)
  const isFirstCommit = useRef(true)

  useEffect(() => {
    onCommitRef.current = onCommit
    localRangeRef.current = localRange
  })

  // Sync local state when the committed value changes externally
  // (URL back/forward, clear-all, mood select). Render-phase adjustment
  // keeps thumbs responsive while dragging.
  const committedKey = rangeKey(value)
  if (prevCommittedKey !== committedKey) {
    setPrevCommittedKey(committedKey)
    setLocalRange(value ?? FULL_RANGE)
  }

  useEffect(() => {
    committedKeyRef.current = committedKey
  })

  function sendCommit(next: RuntimeRange | null) {
    const nextKey = rangeKey(next)
    if (
      nextKey !== committedKeyRef.current &&
      nextKey !== lastSentKeyRef.current
    ) {
      lastSentKeyRef.current = nextKey
      onCommitRef.current(next)
    }
  }

  // Commit the debounced range, mapping full-span back to "off".
  useEffect(() => {
    if (isFirstCommit.current) {
      isFirstCommit.current = false
      return
    }
    sendCommit(isFullRuntimeRange(debouncedRange) ? null : debouncedRange)
  }, [debouncedRange])

  // Flush a pending drag on close: popup content unmounts, which would
  // otherwise cancel the debounce timer and drop the change.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      const pending = localRangeRef.current
      sendCommit(isFullRuntimeRange(pending) ? null : pending)
    }
  }

  function handleReset() {
    setLocalRange(FULL_RANGE)
    sendCommit(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-400">Runtime</label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-44 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors",
            "hover:border-white/20 hover:bg-white/10 hover:text-white",
            "focus:border-primary focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value && "border-primary/40",
          )}
        >
          <span className={cn("truncate", !value && "text-gray-500")}>
            {value ? formatRangeLabel(value) : "All Lengths"}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "size-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <Slider
            value={localRange}
            onValueChange={(next) => setLocalRange(next as RuntimeRange)}
            min={RUNTIME_MIN}
            max={RUNTIME_MAX}
            step={RUNTIME_STEP}
            disabled={disabled}
            formatValue={(minutes) => formatRuntime(minutes) ?? `${minutes}m`}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {hint ? `Runtime ${hint}` : "Filter by runtime"}
            </span>
            {value && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-white"
              >
                Reset
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
