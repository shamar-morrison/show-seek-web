import { RouteGuard } from "@/components/route-guard"

export default function ListsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-36 pb-12 sm:px-8 lg:px-12">
        <RouteGuard
          title="Sign in to view your lists"
          message="Track your watch progress, create custom lists, and more."
        >
          {children}
        </RouteGuard>
      </div>
    </main>
  )
}