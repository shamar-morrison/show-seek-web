import { adminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

interface UpdatePremiumParams {
  email: string
  orderId: string
  productId: string
}

/**
 * Update a user's premium status in Firestore after a successful Polar payment.
 * Finds the user by their email address and sets the premium fields.
 */
export async function updateUserPremiumStatus({
  email,
  orderId,
  productId,
}: UpdatePremiumParams): Promise<void> {
  if (!adminDb) {
    throw new Error("Firebase Admin SDK not configured")
  }

  // Find user by email
  const usersRef = adminDb.collection("users")
  const snapshot = await usersRef.where("email", "==", email).limit(1).get()

  if (snapshot.empty) {
    console.error(`[Polar Webhook] No user found with email: ${email}`)
    throw new Error(`User not found: ${email}`)
  }

  const userDoc = snapshot.docs[0]

  // Update premium status
  await userDoc.ref.update({
    premium: {
      isPremium: true,
      orderId,
      productId,
      purchaseDate: FieldValue.serverTimestamp(),
    },
  })

  console.log(`[Polar Webhook] Premium activated for user: ${userDoc.id}`)
}
