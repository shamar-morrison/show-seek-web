"use client"

import { cn } from "@/lib/utils"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

// ============================================================================
// Type Definitions
// ============================================================================

export interface SliderProps {
  /** Current value - single number or [min, max] for range */
  value: number | number[]
  /** Callback when value changes */
  onValueChange: (value: number | number[]) => void
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step increment */
  step?: number
  /** Whether the slider is disabled */
  disabled?: boolean
  /** Additional class for the root element */
  className?: string
  /** Format function for the value display */
  formatValue?: (value: number) => string
}

// ============================================================================
// Main Component
// ============================================================================

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  formatValue = (v) => String(v),
}: SliderProps) {
  // Normalize value to array for consistent handling
  const normalizedValue = Array.isArray(value) ? value : [value]
  const isRange = Array.isArray(value) && value.length === 2

  return (
    <SliderPrimitive.Root
      value={normalizedValue}
      onValueChange={(newValue) => {
        // Return in same format as input
        onValueChange(isRange ? newValue : newValue[0])
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "relative flex w-full touch-none select-none flex-col gap-2",
        className,
      )}
    >
      {/* Value display for range sliders */}
      {isRange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatValue(normalizedValue[0])}</span>
          <span>—</span>
          <span>{formatValue(normalizedValue[1])}</span>
        </div>
      )}

      <SliderPrimitive.Control
        className={cn(
          "relative flex h-5 w-full items-center",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative h-1.5 w-full grow overflow-hidden rounded-full",
            "bg-white/10",
          )}
        >
          <SliderPrimitive.Indicator
            className={cn("absolute h-full rounded-full", "bg-primary")}
          />
        </SliderPrimitive.Track>
        {/* Render thumb(s) */}
        {normalizedValue.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className={cn(
              "block size-4 rounded-full",
              "bg-white shadow-md",
              "border-2 border-primary",
              "ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "hover:scale-110 transition-transform cursor-grab active:cursor-grabbing",
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
