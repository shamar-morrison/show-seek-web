import { proxyTraktRequest } from "../_proxy"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return proxyTraktRequest(request, "/enrich")
}

export async function POST(request: NextRequest) {
  return proxyTraktRequest(request, "/enrich")
}
