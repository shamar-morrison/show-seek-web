import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  className?: string
}

export function PageHeader({ title, className }: PageHeaderProps) {
  return (
    <h1
      className={cn("mb-8 text-3xl font-bold text-white", className)}
    >
      {title}
    </h1>
  )
}
