import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-2", className)}>
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm/relaxed text-white/65">
          {description}
        </p>
      ) : null}
    </div>
  )
}
