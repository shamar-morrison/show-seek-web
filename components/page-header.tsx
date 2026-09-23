import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  reserveDescriptionSpace?: boolean
}

export function PageHeader({
  title,
  description,
  className,
  reserveDescriptionSpace = false,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-2", className)}>
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      {description || reserveDescriptionSpace ? (
        <p
          className={cn(
            "max-w-2xl text-sm/relaxed text-white/65",
            reserveDescriptionSpace && "line-clamp-2 min-h-[2.875rem]",
          )}
          aria-hidden={description ? undefined : true}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
