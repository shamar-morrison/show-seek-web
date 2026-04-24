import { proxyTraktRequest } from "../_proxy"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return proxyTraktRequest(request, "/sync")
}

export async function POST(request: NextRequest) {
  return proxyTraktRequest(request, "/sync")
}
