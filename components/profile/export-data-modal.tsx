"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { exportToCSV, exportToMarkdown } from "@/lib/export-data"
import { Dialog } from "@base-ui/react/dialog"
import { Cancel01Icon, FileExportIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { toast } from "sonner"

interface ExportDataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDataModal({ open, onOpenChange }: ExportDataModalProps) {
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState<"csv" | "markdown" | null>(null)

  async function handleExport(type: "csv" | "markdown") {
    if (!user) return

    setIsExporting(true)
    setExportType(type)

    try {
      if (type === "csv") {
        await exportToCSV(user.uid)
      } else {
        await exportToMarkdown(user.uid)
      }
      toast.success(`Data exported as ${type.toUpperCase()}`)
      onOpenChange(false)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
      setExportType(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#1a1a1a] p-6 shadow-xl data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-white">
              Export Your Data
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-2 text-sm text-white/60">
            Download all your ShowSeek data including ratings, watch lists,
            notes, and more.
          </Dialog.Description>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/20">
                <HugeiconsIcon
                  icon={FileExportIcon}
                  className="size-5 text-green-400"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">CSV Format</p>
                <p className="text-sm text-white/60">
                  Spreadsheet-compatible format for Excel, Google Sheets
                </p>
              </div>
              {isExporting && exportType === "csv" && (
                <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              )}
            </button>

            <button
              onClick={() => handleExport("markdown")}
              disabled={isExporting}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/20">
                <HugeiconsIcon
                  icon={FileExportIcon}
                  className="size-5 text-blue-400"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Markdown Format</p>
                <p className="text-sm text-white/60">
                  Human-readable format for notes, blogs, documentation
                </p>
              </div>
              {isExporting && exportType === "markdown" && (
                <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              )}
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
