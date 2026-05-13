import { useUrlStateSync } from "@/hooks/use-url-state-sync"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const DEFAULT_LIST_ID = "watchlist"

function setLocation(search = "", pathname = "/lists/custom-lists") {
  window.history.pushState({}, "", `${pathname}${search}`)
}

function hasRenderPhaseUpdateWarning(calls: unknown[][]) {
  return calls.some((call) =>
    call.some(
      (value) =>
        typeof value === "string" &&
        value.includes("Cannot update a component"),
    ),
  )
}

function ParentSelectionHarness() {
  const [urlState, setUrlState] = useUrlStateSync<{ selectedListId: string }>({
    keys: ["listId"],
    parse: (params) => ({
      selectedListId: params.get("listId") ?? "",
    }),
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.selectedListId && state.selectedListId !== DEFAULT_LIST_ID) {
        params.set("listId", state.selectedListId)
      }

      return params
    },
  })
  const effectiveSelectedListId = urlState.selectedListId || DEFAULT_LIST_ID

  return (
    <div>
      <div data-testid="selected-list">{effectiveSelectedListId}</div>
      <ChildFilterHarness
        selectedListId={effectiveSelectedListId}
        onListSelect={(selectedListId) => setUrlState({ selectedListId })}
      />
    </div>
  )
}

function ChildFilterHarness({
  selectedListId,
  onListSelect,
}: {
  selectedListId: string
  onListSelect: (listId: string) => void
}) {
  const [urlState] = useUrlStateSync<{ searchQuery: string }>({
    keys: ["q"],
    parse: (params) => ({
      searchQuery: params.get("q")?.trim() ?? "",
    }),
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.searchQuery) {
        params.set("q", state.searchQuery)
      }

      return params
    },
  })

  return (
    <div>
      <div data-testid="child-selected-list">{selectedListId}</div>
      <div data-testid="search-query">{urlState.searchQuery}</div>
      <button type="button" onClick={() => onListSelect("favorites")}>
        Favorites
      </button>
    </div>
  )
}

function CanonicalizationHarness({
  children,
}: {
  children?: ReactNode
}) {
  const [urlState] = useUrlStateSync<{
    selectedListId: string
    direction: "asc" | "desc"
  }>({
    keys: ["listId", "dir"],
    parse: (params) => ({
      selectedListId:
        params.get("listId") === DEFAULT_LIST_ID
          ? ""
          : params.get("listId") ?? "",
      direction: params.get("dir") === "asc" ? "asc" : "desc",
    }),
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.selectedListId) {
        params.set("listId", state.selectedListId)
      }

      if (state.direction !== "desc") {
        params.set("dir", state.direction)
      }

      return params
    },
  })

  return (
    <div>
      <div data-testid="canonical-selected">
        {urlState.selectedListId || DEFAULT_LIST_ID}
      </div>
      <div data-testid="canonical-direction">{urlState.direction}</div>
      {children}
    </div>
  )
}

describe("useUrlStateSync", () => {
  beforeEach(() => {
    setLocation()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("updates shared list state after commit without triggering the render-phase warning", async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    setLocation("?q=spirited")

    render(<ParentSelectionHarness />)

    expect(screen.getByTestId("selected-list")).toHaveTextContent(DEFAULT_LIST_ID)
    expect(screen.getByTestId("search-query")).toHaveTextContent("spirited")

    await user.click(screen.getByRole("button", { name: "Favorites" }))

    await waitFor(() => {
      expect(screen.getByTestId("selected-list")).toHaveTextContent("favorites")
    })

    expect(screen.getByTestId("child-selected-list")).toHaveTextContent("favorites")
    expect(screen.getByTestId("search-query")).toHaveTextContent("spirited")
    expect(new URLSearchParams(window.location.search).get("listId")).toBe(
      "favorites",
    )
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "spirited",
    )
    expect(hasRenderPhaseUpdateWarning(consoleErrorSpy.mock.calls)).toBe(false)
  })

  it("canonicalizes default and invalid managed params without looping", async () => {
    setLocation("?listId=watchlist&dir=sideways")

    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    render(<CanonicalizationHarness />)

    await waitFor(() => {
      expect(window.location.search).toBe("")
    })

    expect(screen.getByTestId("canonical-selected")).toHaveTextContent(
      DEFAULT_LIST_ID,
    )
    expect(screen.getByTestId("canonical-direction")).toHaveTextContent("desc")
    expect(replaceStateSpy).toHaveBeenCalledTimes(1)
  })
})
