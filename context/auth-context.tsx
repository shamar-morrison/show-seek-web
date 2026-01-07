"use client"

import { auth, db } from "@/lib/firebase/config"
import { UserDocument } from "@/lib/firebase/user"
import {
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
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
  isPremium: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Listen to user document for premium status
  useEffect(() => {
    if (!user) {
      setIsPremium(false)
      return
    }

    const userDocRef = doc(db, "users", user.uid)
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data() as UserDocument
        setIsPremium(userData.premium?.isPremium ?? false)
      } else {
        setIsPremium(false)
      }
    })

    return unsubscribe
  }, [user])

  const signOut = async () => {
    try {
      // Clear server-side session first
      const response = await fetch("/api/auth/logout", { method: "POST" })

      if (!response.ok) {
        throw new Error("Failed to sign out from server")
      }

      // Then sign out from Firebase client
      await firebaseSignOut(auth)
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, isPremium, signOut }}>
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
