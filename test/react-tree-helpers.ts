import { isValidElement, type ReactElement, type ReactNode } from "react"

export function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)]
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText)
  }

  if (isValidElement(node)) {
    return collectText(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    )
  }

  return []
}

export function findElementByType(
  node: ReactNode,
  type: unknown,
): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findElementByType(child, type)
        if (match) {
          return match
        }
      }
    }

    return null
  }

  if (node.type === type) {
    return node as ReactElement<Record<string, unknown>>
  }

  return findElementByType(
    (node as ReactElement<{ children?: ReactNode }>).props.children,
    type,
  )
}
