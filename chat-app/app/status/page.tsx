import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import StatusPageContent from "@/components/StatusPageContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Status",
  description: "Live status of Nullchat: website, database, image storage and realtime messaging.",
  path: "/status",
});

export default function StatusPage() {
  return <StatusPageContent />;
}
