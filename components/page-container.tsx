import { cn } from "@/lib/utils"

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Standard container for page content to ensure consistent max-width and padding
 * across the application. Matches the Navbar alignment.
 */
export function PageContainer({
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
