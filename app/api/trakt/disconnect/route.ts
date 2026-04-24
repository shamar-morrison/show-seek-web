import { proxyTraktRequest } from "../_proxy"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  return proxyTraktRequest(request, "/disconnect")
}
