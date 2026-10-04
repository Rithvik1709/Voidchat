import type { Metadata } from "next";
import StatusPageContent from "@/components/StatusPageContent";

export const metadata: Metadata = {
  title: "Status — Nullchat",
  description: "Live status of Nullchat: website, database, image storage and realtime messaging.",
};

export default function StatusPage() {
  return <StatusPageContent />;
}
