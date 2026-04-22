"use client"

import { cn } from "@/lib/utils"
import { useEffect, useId, useMemo, useRef, useState } from "react"

const TURNSTILE_SCRIPT_SELECTOR =
  'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'

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
  const reactId = useId()
  const containerId = useMemo(
    () => `turnstile-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId],
  )
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState("")
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""

  useEffect(() => {
    if (!siteKey || typeof window === "undefined") {
      return
    }

    let disposed = false
    let loadListenerScript: HTMLScriptElement | null = null
    let retryIntervalId: number | null = null

    const renderWidget = () => {
      if (
        disposed ||
        widgetIdRef.current ||
        !document.getElementById(containerId)
      ) {
        return
      }

      const turnstile = window.turnstile

      if (!turnstile?.render) {
        return
      }

      widgetIdRef.current = turnstile.render(`#${containerId}`, {
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

      if (loadListenerScript) {
        loadListenerScript.removeEventListener("load", renderWidget)
        loadListenerScript = null
      }
    }

    renderWidget()

    if (!widgetIdRef.current) {
      loadListenerScript = document.querySelector<HTMLScriptElement>(
        TURNSTILE_SCRIPT_SELECTOR,
      )
      loadListenerScript?.addEventListener("load", renderWidget)
    }

    if (!widgetIdRef.current) {
      retryIntervalId = window.setInterval(renderWidget, 250)
    }

    return () => {
      disposed = true

      if (retryIntervalId) {
        window.clearInterval(retryIntervalId)
      }

      loadListenerScript?.removeEventListener("load", renderWidget)

      if (widgetIdRef.current) {
        window.turnstile?.remove?.(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, containerId, siteKey])

  return (
    <div className={cn("min-h-[65px]", className)}>
      <div id={containerId} />
      <input
        type="hidden"
        name="cf-turnstile-response"
        value={token}
        readOnly
      />
    </div>
  )
}
