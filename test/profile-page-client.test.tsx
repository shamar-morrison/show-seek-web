import { isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const preferenceToggleMock = vi.fn(() => null)
const updatePreferenceMock = vi.fn()
const signOutMock = vi.fn()

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")

  return {
    ...actual,
    useState: (initialValue: unknown) => [initialValue, vi.fn()],
  }
})

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
}))

vi.mock("@/components/profile/action-button", () => ({
  ActionButton: () => null,
}))

vi.mock("@/components/profile/export-data-modal", () => ({
  ExportDataModal: () => null,
}))

vi.mock("@/components/profile/HomeScreenCustomizer", () => ({
  HomeScreenCustomizer: () => null,
}))

vi.mock("@/components/profile/preference-toggle", () => ({
  PreferenceToggle: preferenceToggleMock,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: () => null,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: () => null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      displayName: "Test User",
      email: "test@example.com",
      photoURL: null,
    },
    loading: false,
    premiumLoading: false,
    premiumStatus: "free",
    signOut: signOutMock,
  }),
}))

vi.mock("@/hooks/use-preferences", async () => {
  const { DEFAULT_PREFERENCES } = await import("@/lib/user-preferences")

  return {
    usePreferences: () => ({
      preferences: DEFAULT_PREFERENCES,
      isLoading: false,
      updatePreference: updatePreferenceMock,
    }),
  }
})

vi.mock("@/lib/premium-gating", () => ({
  PREMIUM_LOADING_MESSAGE: "Checking premium status",
  isPremiumStatusPending: () => false,
  shouldEnforcePremiumLock: () => false,
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn(),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("@/lib/utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    captureException: vi.fn(),
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

function findElementsByType(
  node: ReactNode,
  type: unknown,
): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      return node.flatMap((child) => findElementsByType(child, type))
    }

    return []
  }

  const matches =
    node.type === type ? [node as ReactElement<Record<string, unknown>>] : []

  return matches.concat(
    findElementsByType(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
      type,
    ),
  )
}

type PreferenceToggleElement = ReactElement<{
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}>

describe("ProfilePageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the auto-remove preference and updates it", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")

    const tree = ProfilePageClient()
    const preferenceElements = findElementsByType(tree, preferenceToggleMock)
    const autoRemoveToggle = preferenceElements.find(
      (element) => element.props.label === "Auto-remove from Should Watch",
    ) as PreferenceToggleElement | undefined

    expect(autoRemoveToggle).toBeDefined()
    expect(autoRemoveToggle?.props.checked).toBe(true)

    autoRemoveToggle?.props.onChange(false)

    expect(updatePreferenceMock).toHaveBeenCalledWith(
      "autoRemoveFromShouldWatch",
      false,
    )
  })
})
