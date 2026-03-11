"use client"

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getFunctions, type Functions } from "firebase/functions"

const REQUIRED_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const

type FirebaseClientConfigKey = (typeof REQUIRED_FIREBASE_ENV_KEYS)[number]

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const missingFirebaseClientConfigKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
  const value = process.env[key]
  return typeof value !== "string" || value.trim() === ""
})

export const FIREBASE_CLIENT_CONFIG_ERROR_CODE = "firebase/client-config-missing"
export const isFirebaseClientConfigured =
  missingFirebaseClientConfigKeys.length === 0

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let functionsInstance: Functions | null = null
let persistenceConfigured = false

export function getFirebaseClientConfigErrorMessage(): string {
  if (missingFirebaseClientConfigKeys.length === 0) {
    return "Firebase client configuration is invalid."
  }

  return `Firebase client configuration is missing: ${missingFirebaseClientConfigKeys.join(", ")}.`
}

export function createFirebaseClientConfigError(): Error & { code: string } {
  const error = new Error(
    getFirebaseClientConfigErrorMessage(),
  ) as Error & { code: string }
  error.name = "FirebaseClientConfigError"
  error.code = FIREBASE_CLIENT_CONFIG_ERROR_CODE
  return error
}

export function isFirebaseClientConfigError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === FIREBASE_CLIENT_CONFIG_ERROR_CODE
  )
}

function ensureFirebaseClientConfigured(): void {
  if (!isFirebaseClientConfigured) {
    throw createFirebaseClientConfigError()
  }
}

export function getMissingFirebaseClientConfigKeys(): FirebaseClientConfigKey[] {
  return [...missingFirebaseClientConfigKeys]
}

function getFirebaseApp(): FirebaseApp {
  ensureFirebaseClientConfigured()

  if (appInstance) {
    return appInstance
  }

  appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  return appInstance
}

export function getFirebaseAuth(): Auth {
  if (authInstance) {
    return authInstance
  }

  authInstance = getAuth(getFirebaseApp())

  if (typeof window !== "undefined" && !persistenceConfigured) {
    persistenceConfigured = true
    void setPersistence(authInstance, browserLocalPersistence).catch((error) => {
      persistenceConfigured = false
      console.error("Firebase persistence error:", error)
    })
  }

  return authInstance
}

export function getFirebaseDb(): Firestore {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = getFirestore(getFirebaseApp())
  return dbInstance
}

export function getFirebaseFunctions(): Functions {
  if (functionsInstance) {
    return functionsInstance
  }

  functionsInstance = getFunctions(getFirebaseApp())
  return functionsInstance
}
