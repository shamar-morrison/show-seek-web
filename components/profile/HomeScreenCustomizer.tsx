"use client"

import { PremiumBadge } from "@/components/premium-badge"
import { PremiumModal } from "@/components/premium-modal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import { HomeScreenListItem } from "@/lib/firebase/user"
import {
  AVAILABLE_TMDB_LISTS,
  DEFAULT_HOME_LISTS,
  MAX_HOME_LISTS,
  MIN_HOME_LISTS,
  PREMIUM_LIST_ID,
} from "@/lib/home-screen-lists"
import { cn } from "@/lib/utils"
import { DEFAULT_LISTS, isDefaultList } from "@/types/list"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

interface HomeScreenCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HomeScreenCustomizer({
  open,
  onOpenChange,
}: HomeScreenCustomizerProps) {
  const { isPremium } = useAuth()
  const { preferences, updateHomeScreenLists } = usePreferences()
  const { lists: userLists } = useLists()

  // Get saved lists or defaults
  const savedLists = preferences.homeScreenLists ?? DEFAULT_HOME_LISTS

  // Local state for selections
  const [selectedLists, setSelectedLists] =
    useState<HomeScreenListItem[]>(savedLists)
  const [isSaving, setIsSaving] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  // Reset local state when modal opens or saved lists change
  useEffect(() => {
    if (open) {
      setSelectedLists(savedLists)
    }
  }, [open, savedLists])

  // Get custom lists (non-default)
  const customLists = useMemo(
    () => userLists.filter((list) => !isDefaultList(list.id)),
    [userLists],
  )

  // Check if a list is selected
  function isSelected(id: string): boolean {
    return selectedLists.some((item) => item.id === id)
  }

  // Handle selection toggle
  function handleToggle(
    id: string,
    type: HomeScreenListItem["type"],
    label: string,
  ) {
    // Check premium lock
    if (id === PREMIUM_LIST_ID && !isPremium) {
      setShowPremiumModal(true)
      return
    }

    setSelectedLists((prev) => {
      const isCurrentlySelected = prev.some((item) => item.id === id)

      if (isCurrentlySelected) {
        // Prevent unselecting if at minimum
        if (prev.length <= MIN_HOME_LISTS) {
          toast.error(`You must have at least ${MIN_HOME_LISTS} list selected`)
          return prev
        }
        return prev.filter((item) => item.id !== id)
      } else {
        // Prevent selecting if at maximum
        if (prev.length >= MAX_HOME_LISTS) {
          toast.error(`You can only select up to ${MAX_HOME_LISTS} lists`)
          return prev
        }
        return [...prev, { id, type, label }]
      }
    })
  }

  // Save changes to Firestore
  async function handleSave() {
    try {
      setIsSaving(true)
      await updateHomeScreenLists(selectedLists)
      toast.success("Home screen updated")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save home screen lists:", error)
      toast.error("Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to saved state
  function handleCancel() {
    setSelectedLists(savedLists)
    onOpenChange(false)
  }

  const selectedCount = selectedLists.length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Customize Home Screen</DialogTitle>
            <DialogDescription>
              Select up to {MAX_HOME_LISTS} lists to display on your home
              screen. ({selectedCount}/{MAX_HOME_LISTS} selected)
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="-mx-6 max-h-[50vh]" viewportClassName="px-6">
            <div className="space-y-6">
              {/* TMDB Lists */}
              <ListCategory title="TMDB Lists">
                {AVAILABLE_TMDB_LISTS.map((list) => (
                  <ListItem
                    key={list.id}
                    id={list.id}
                    label={list.label}
                    checked={isSelected(list.id)}
                    onChange={() => handleToggle(list.id, "tmdb", list.label)}
                    isPremiumOnly={list.id === PREMIUM_LIST_ID}
                    isPremium={isPremium}
                  />
                ))}
              </ListCategory>

              {/* Watch Status Lists */}
              <ListCategory title="Watch Status">
                {DEFAULT_LISTS.map((list) => (
                  <ListItem
                    key={list.id}
                    id={list.id}
                    label={list.name}
                    checked={isSelected(list.id)}
                    onChange={() => handleToggle(list.id, "default", list.name)}
                  />
                ))}
              </ListCategory>

              {/* Custom Lists */}
              {customLists.length > 0 && (
                <ListCategory title="Custom Lists">
                  {customLists.map((list) => (
                    <ListItem
                      key={list.id}
                      id={list.id}
                      label={list.name}
                      checked={isSelected(list.id)}
                      onChange={() =>
                        handleToggle(list.id, "custom", list.name)
                      }
                    />
                  ))}
                </ListCategory>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleCancel} className="w-full">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />
    </>
  )
}

// Category section component
function ListCategory({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

// Individual list item component
function ListItem({
  id,
  label,
  checked,
  onChange,
  isPremiumOnly = false,
  isPremium = false,
}: {
  id: string
  label: string
  checked: boolean
  onChange: () => void
  isPremiumOnly?: boolean
  isPremium?: boolean
}) {
  const isLocked = isPremiumOnly && !isPremium

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5",
        isLocked && "cursor-pointer opacity-60",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className={cn(isLocked && "pointer-events-none")}
      />
      <span className="flex-1 text-sm text-white">{label}</span>
      {isPremiumOnly && <PremiumBadge isPremium={isPremium} />}
    </label>
  )
}
