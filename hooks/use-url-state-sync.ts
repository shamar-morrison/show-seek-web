"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const URL_STATE_SYNC_EVENT = "showseek:url-state-sync"

type StateUpdater<T> = T | ((currentState: T) => T)

interface UseUrlStateSyncOptions<T> {
  keys: string[]
  parse: (params: URLSearchParams) => T
  serialize: (state: T) => URLSearchParams
}

function getSerializedState<T>(
  state: T,
  serialize: (state: T) => URLSearchParams,
): string {
  return serialize(state).toString()
}

function buildUrlWithManagedState<T>({
  keys,
  serialize,
  state,
}: {
  keys: string[]
  serialize: (state: T) => URLSearchParams
  state: T
}) {
  const currentParams = new URLSearchParams(window.location.search)

  for (const key of keys) {
    currentParams.delete(key)
  }

  for (const [key, value] of serialize(state).entries()) {
    currentParams.append(key, value)
  }

  const nextSearch = currentParams.toString()
  const nextPath = window.location.pathname
  const nextHash = window.location.hash

  return nextSearch
    ? `${nextPath}?${nextSearch}${nextHash}`
    : `${nextPath}${nextHash}`
}

export function useUrlStateSync<T>({
  keys,
  parse,
  serialize,
}: UseUrlStateSyncOptions<T>) {
  const searchParams = useSearchParams()
  const searchParamsString = searchParams?.toString() ?? ""
  const keysSignature = keys.join("\0")
  const keysRef = useRef(keys)
  const parseRef = useRef(parse)
  const serializeRef = useRef(serialize)

  keysRef.current = keys
  parseRef.current = parse
  serializeRef.current = serialize

  const [state, setState] = useState<T>(() =>
    parse(new URLSearchParams(searchParamsString)),
  )

  const syncFromParams = useCallback(
    (params: URLSearchParams) => {
      const nextState = parseRef.current(params)

      setState((currentState) =>
        getSerializedState(currentState, serializeRef.current) ===
        getSerializedState(nextState, serializeRef.current)
          ? currentState
          : nextState,
      )
    },
    [],
  )

  const serializedState = getSerializedState(state, serialize)

  useEffect(() => {
    syncFromParams(new URLSearchParams(searchParamsString))
  }, [searchParamsString, syncFromParams])

  useEffect(() => {
    const handleUrlStateChange = () => {
      syncFromParams(new URLSearchParams(window.location.search))
    }

    window.addEventListener("popstate", handleUrlStateChange)
    window.addEventListener(URL_STATE_SYNC_EVENT, handleUrlStateChange)

    return () => {
      window.removeEventListener("popstate", handleUrlStateChange)
      window.removeEventListener(URL_STATE_SYNC_EVENT, handleUrlStateChange)
    }
  }, [syncFromParams])

  const updateState = useCallback(
    (updater: StateUpdater<T>) => {
      setState((currentState) => {
        const nextState =
          typeof updater === "function"
            ? (updater as (currentState: T) => T)(currentState)
            : updater

        return getSerializedState(currentState, serializeRef.current) ===
          getSerializedState(nextState, serializeRef.current)
          ? currentState
          : nextState
      })
    },
    [],
  )

  useEffect(() => {
    const nextUrl = buildUrlWithManagedState({
      keys: keysRef.current,
      serialize: serializeRef.current,
      state,
    })
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl)
      window.dispatchEvent(new Event(URL_STATE_SYNC_EVENT))
    }
  }, [keysSignature, searchParamsString, serializedState, state])

  return [state, updateState] as const
}
