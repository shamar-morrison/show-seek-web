"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface PaginationProps {
  /** Current page (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of results */
  totalResults: number
  /** Number of results per page */
  resultsPerPage?: number
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Maximum page buttons to show */
  maxVisiblePages?: number
}

/**
 * Pagination component matching the reference design.
 * Shows "Showing X-Y of Z results" text with prev/next arrows and page numbers.
 */
export function Pagination({
  currentPage,
  totalPages,
  totalResults,
  resultsPerPage = 20,
  onPageChange,
  maxVisiblePages = 5,
}: PaginationProps) {
  // Don't render if there's only one page or no results
  if (totalPages <= 1 || totalResults === 0) return null

  const startResult = (currentPage - 1) * resultsPerPage + 1
  const endResult = Math.min(currentPage * resultsPerPage, totalResults)

  // Calculate which page numbers to show
  const getVisiblePages = (): number[] => {
    const pages: number[] = []

    // For small total pages, show all
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Calculate start and end of visible range
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let end = start + maxVisiblePages - 1

    // Adjust if we're near the end
    if (end > totalPages) {
      end = totalPages
      start = Math.max(1, end - maxVisiblePages + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return pages
  }

  const visiblePages = getVisiblePages()
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Results count */}
      <p className="text-sm text-gray-400">
        Showing {startResult}-{endResult} of {totalResults.toLocaleString()}{" "}
        results
      </p>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-transparent text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          aria-label="Previous page"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </button>

        {/* Page numbers */}
        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
              page === currentPage
                ? "border-primary bg-primary text-white"
                : "border-white/10 bg-transparent text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-transparent text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          aria-label="Next page"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </button>
      </div>
    </div>
  )
}
