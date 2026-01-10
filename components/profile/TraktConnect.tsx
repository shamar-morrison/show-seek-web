"use client"

import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"

export function TraktConnect() {
  const { user } = useAuth()
  const router = useRouter()

  function handleClick() {
    if (!user?.uid) return
    router.push("/profile/trakt")
  }

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5"
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-[#ED1C24]/20">
        <svg className="size-5" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            fill="#ED1C24"
          />
          <circle cx="12" cy="12" r="4" fill="#ED1C24" />
        </svg>
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-white">Connect to Trakt</span>
        <p className="text-xs text-white/40">
          Sync your watch history and ratings
        </p>
      </div>
      <svg
        className="size-5 text-white/40"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
