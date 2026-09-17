interface JsonLdProps {
  data: unknown
}

/**
 * Renders a JSON-LD structured data script tag for SEO.
 * Server-component only — data must be serializable.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
