import { serializeJsonLd } from "@/lib/jsonld"

interface JsonLdProps {
  data: unknown
}

/**
 * Renders a JSON-LD structured data script tag for SEO.
 * Server-component only — data must be serializable.
 * Payload is escaped via serializeJsonLd so TMDB-sourced strings can never
 * break out of the script tag.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
