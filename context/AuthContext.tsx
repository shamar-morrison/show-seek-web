"use client"

import { auth } from "@/lib/firebase/config"
import {
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signOut = async () => {
    try {
      // Clear server-side session first
      await fetch("/api/auth/logout", { method: "POST" })

      // Then sign out from Firebase client
      await firebaseSignOut(auth)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
