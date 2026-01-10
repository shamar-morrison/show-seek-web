import { App, cert, getApps, initializeApp } from "firebase-admin/app"
import { Auth, getAuth } from "firebase-admin/auth"
import { Firestore, getFirestore } from "firebase-admin/firestore"

function getFirebaseAdmin(): {
  app: App | null
  adminAuth: Auth | null
  adminDb: Firestore | null
} {
  if (!getApps().length) {
    // Check if we have the required environment variables
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "Firebase Admin SDK credentials not configured. Server-side auth will not work.",
      )
      return {
        app: null,
        adminAuth: null,
        adminDb: null,
      }
    }

    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Replace escaped newlines in private key
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    })

    return { app, adminAuth: getAuth(app), adminDb: getFirestore(app) }
  }

  const app = getApps()[0]
  return { app, adminAuth: getAuth(app), adminDb: getFirestore(app) }
}

const firebaseAdmin = getFirebaseAdmin()

export const adminAuth = firebaseAdmin.adminAuth
export const adminDb = firebaseAdmin.adminDb
