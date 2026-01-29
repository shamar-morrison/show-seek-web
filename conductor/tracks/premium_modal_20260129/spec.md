# Specification: Implement Premium Upgrade Modal

## Objective
Replace the existing placeholder `PremiumModal` with a more detailed and engaging design that showcases the benefits of a premium subscription and provides a clear call-to-action.

## Requirements
1.  **Feature Showcase:** Display a list of key premium features with descriptive icons:
    - **Unlimited Custom Lists:** Create as many lists as you want.
    - **Hide Watched Content:** Automatically filter out what you've already seen.
    - **Advanced Filters:** Discover content by watch providers (Netflix, HBO, etc.).
    - **Exclusive Content:** Access the 'Latest Trailers' home screen list.
    - **Premium Status:** Get the exclusive Crown badge on your profile.
2.  **Call to Action (CTA):**
    - A button at the bottom labeled "Sounds Great, Let's go".
    - Clicking the button opens a dummy checkout URL in a new browser tab.
3.  **Visual Consistency:**
    - Maintain the dark-mode aesthetic.
    - Use `Hugeicons` (already integrated in the project).
    - Ensure the layout is responsive and looks good on all screen sizes.

## Technical Details
- **File to Modify:** `components/premium-modal.tsx`
- **Dependencies:** Uses Radix UI Dialog components (via `@/components/ui/dialog`) and Hugeicons.
