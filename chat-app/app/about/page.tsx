import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AboutPageContent from "@/components/AboutPageContent";

const description =
    "How Nullchat works: anonymous group rooms with no accounts, one-time invite links, burn mode, optional passwords and member limits, and nothing kept once a room ends.";

export const metadata: Metadata = buildPageMetadata({ title: "About: private, ephemeral group chat", description, path: "/about" });

export default function AboutPage() {
    return <AboutPageContent />;
}
