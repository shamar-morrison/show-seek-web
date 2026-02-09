import { updateUserPremiumStatus } from "@/lib/polar/update-premium"
import { Webhooks } from "@polar-sh/nextjs"

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onOrderPaid: async (payload) => {
    console.log("[Polar Webhook] Received order.paid event:", payload.data.id)

    // Extract customer email from the order
    const email = payload.data.customer.email

    if (!email) {
      console.error("[Polar Webhook] No email found in order payload")
      throw new Error("Customer email not found in order")
    }

    // Update Firestore premium status
    await updateUserPremiumStatus({
      email,
      orderId: payload.data.id,
      productId: payload.data.product?.id ?? "polar_premium",
    })

    console.log(
      "[Polar Webhook] Successfully processed order:",
      payload.data.id,
    )
  },
})
