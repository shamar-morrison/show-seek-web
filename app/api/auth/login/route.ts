import { handlePasswordAuthRequest } from "@/app/api/auth/password-route"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  return handlePasswordAuthRequest(request, "login")
}
