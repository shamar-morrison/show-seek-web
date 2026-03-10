import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

function TestProviders({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return rtlRender(ui, {
    wrapper: TestProviders,
    ...options,
  })
}

export * from "@testing-library/react"
