"use client"

import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

type TurnstileRenderOptions = {
  action?: string
  callback?: (token: string) => void
  "error-callback"?: () => void
  "expired-callback"?: () => void
  "response-field"?: boolean
  sitekey: string
}

type TurnstileApi = {
  remove?: (widgetId: string) => void
  render: (
    container: HTMLElement | string,
    options: TurnstileRenderOptions,
  ) => string
  reset?: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

interface TurnstileWidgetProps {
  action: "login" | "signup"
  className?: string
}

export function TurnstileWidget({ action, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState("")
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""

  useEffect(() => {
    if (!siteKey || typeof window === "undefined") {
      return
    }

    let disposed = false
    let retryIntervalId: number | null = null

    const renderWidget = () => {
      if (disposed || widgetIdRef.current || !containerRef.current) {
        return
      }

      const turnstile = window.turnstile

      if (!turnstile?.render) {
        return
      }

      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        "response-field": false,
        callback: (nextToken) => setToken(nextToken),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      })

      if (retryIntervalId) {
        window.clearInterval(retryIntervalId)
        retryIntervalId = null
      }
    }

    renderWidget()

    if (!widgetIdRef.current) {
      retryIntervalId = window.setInterval(renderWidget, 250)
    }

    return () => {
      disposed = true

      if (retryIntervalId) {
        window.clearInterval(retryIntervalId)
      }

      if (widgetIdRef.current) {
        window.turnstile?.remove?.(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, siteKey])

  return (
    <div className={cn("min-h-[65px]", className)}>
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-action={action}
      />
      <input
        type="hidden"
        name="cf-turnstile-response"
        value={token}
        readOnly
      />
    </div>
  )
}
