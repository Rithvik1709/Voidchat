import { serializeJsonLd } from "@/lib/seo";

/** Embeds structured data (schema.org) for search engines. */
export default function JsonLd({ data }: { data: unknown }) {
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />;
}
