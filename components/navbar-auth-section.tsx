"use client"

import { AuthModal } from "@/components/auth-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/user-menu"
import { useAuth } from "@/context/auth-context"

export function NavbarAuthSection() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Skeleton className="h-9 w-[100px] rounded-lg" />
  }

  return user ? <UserMenu /> : <AuthModal />
}
