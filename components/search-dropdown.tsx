"use client"

import { searchMedia } from "@/app/actions"
import { SearchResultItem } from "@/components/search-result-item"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { debounceWithCancel } from "@/lib/debounce"
import { cn } from "@/lib/utils"
import type { TMDBSearchResult } from "@/types/tmdb"
import { Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

const DEBOUNCE_DELAY = 300
const MAX_RESULTS = 6

interface SearchDropdownProps {
  className?: string
}

/**
 * Search Dropdown Component
 * Debounced search input with dropdown showing top 6 results
 */
export function SearchDropdown({ className }: SearchDropdownProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    startTransition(async () => {
      const response = await searchMedia(searchQuery)
      setResults(response.results.slice(0, MAX_RESULTS))
      setIsOpen(true)
      setSelectedIndex(-1)
    })
  }, [])

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounceWithCancel((searchQuery: string) => {
        performSearch(searchQuery)
      }, DEBOUNCE_DELAY),
    [performSearch],
  )

  // Clean up pending search on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  // Navigate to result detail page
  const navigateToResult = (result: TMDBSearchResult) => {
    setIsOpen(false)
    setQuery("")

    if (result.media_type === "movie") {
      router.push(`/movie/${result.id}`)
    } else if (result.media_type === "tv") {
      router.push(`/tv/${result.id}`)
    } else if (result.media_type === "person") {
      router.push(`/person/${result.id}`)
    }
  }

  // Navigate to full search results page
  const navigateToSearchPage = () => {
    if (!query.trim()) return
    setIsOpen(false)
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" && query.trim()) {
        navigateToSearchPage()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        // +1 for the "View all results" button
        setSelectedIndex((prev) => (prev < results.length ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex === -1 || selectedIndex === results.length) {
          navigateToSearchPage()
        } else if (selectedIndex >= 0 && selectedIndex < results.length) {
          navigateToResult(results[selectedIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle focus
  const handleFocus = () => {
    if (query.trim() && results.length > 0) {
      setIsOpen(true)
    }
  }

  const hasResults = results.length > 0
  const showNoResults = isOpen && query.trim() && !isPending && !hasResults

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <HugeiconsIcon
          icon={isPending ? Loading03Icon : Search01Icon}
          className={cn(
            "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400",
            isPending && "animate-spin",
          )}
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="h-9 w-48 rounded-full border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20 lg:w-64"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-md lg:w-96">
          {/* Results List */}
          {hasResults && (
            <div className="max-h-[400px] overflow-y-auto p-2">
              {results.map((result, index) => (
                <div
                  key={`${result.media_type}-${result.id}`}
                  className={cn(
                    "rounded-lg transition-colors",
                    selectedIndex === index && "bg-white/10",
                  )}
                >
                  <SearchResultItem
                    result={result}
                    onClick={() => navigateToResult(result)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {showNoResults && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">
                No results found for &quot;{query}&quot;
              </p>
            </div>
          )}

          {/* View All Results Button */}
          {hasResults && query.trim() && (
            <div className="border-t border-white/10 p-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-center rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white",
                  selectedIndex === results.length && "bg-white/10 text-white",
                )}
                onClick={navigateToSearchPage}
              >
                View all results
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
