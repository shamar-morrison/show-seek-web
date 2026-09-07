import { FavoritePersonButton } from "@/components/favorite-person-button"
import { render, screen } from "@/test/utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isFavorited: false,
  favLoading: false,
  isAdding: false,
  isRemoving: false,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => <div>auth-modal</div>,
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: (callback?: () => void | Promise<void>) => callback?.(),
    modalVisible: false,
    closeModal: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-favorite-persons", () => ({
  useIsPersonFavorited: () => ({
    isFavorited: mocks.isFavorited,
    loading: mocks.favLoading,
  }),
  useFavoritePersonActions: () => ({
    addPerson: vi.fn(),
    removePerson: vi.fn(),
    isAdding: mocks.isAdding,
    isRemoving: mocks.isRemoving,
  }),
}))

const person = {
  id: 101,
  name: "Sample Person",
  profile_path: "/profile.jpg",
  known_for_department: "Acting",
}

describe("FavoritePersonButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isFavorited = false
    mocks.favLoading = false
    mocks.isAdding = false
    mocks.isRemoving = false
  })

  it("uses the accent color when not favorited", () => {
    render(<FavoritePersonButton person={person} />)

    const button = screen.getByRole("button", {
      name: "Add to favorite people",
    })

    expect(button.className).toContain("bg-primary")
    expect(button.className).not.toContain("bg-red-600")
  })

  it("uses the accent border on surface instead of red when favorited", () => {
    mocks.isFavorited = true

    render(<FavoritePersonButton person={person} />)

    const button = screen.getByRole("button", {
      name: "Remove from favorites",
    })

    expect(button.className).toContain("border-primary")
    expect(button.className).toContain("bg-[#232323]")
    expect(button.className).not.toContain("bg-red-600")
  })
})
