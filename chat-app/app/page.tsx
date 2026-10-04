import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import JsonLd from "@/components/JsonLd";
import { FAQ } from "@/lib/siteContent";
import { SITE } from "@/lib/site";
import { buildFaqJsonLd, buildPageMetadata, buildWebAppJsonLd, buildWebSiteJsonLd } from "@/lib/seo";

// The home page uses the full title; other pages get "<page> | Nullchat" from the root template
export const metadata: Metadata = buildPageMetadata({ title: SITE.title, description: SITE.description, path: "/", absoluteTitle: true });

export default function Page() {
  return (
    <>
      <JsonLd data={buildWebSiteJsonLd()} />
      <JsonLd data={buildWebAppJsonLd()} />
      <JsonLd data={buildFaqJsonLd(FAQ)} />
      <HomePage />
    </>
  );
}
