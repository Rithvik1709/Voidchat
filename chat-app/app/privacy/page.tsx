import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "How Nullchat handles ephemeral rooms, encryption, temporary identifiers, and media lifecycle.",
  path: "/privacy",
});

const sections: LegalSection[] = [
  {
    title: "1. Core privacy model",
    body: "Nullchat is built for temporary conversations. Rooms are designed to be short-lived, and we minimize persistent data by default.",
  },
  {
    title: "2. What we collect",
    body: "We do not require account creation for standard use. Temporary identifiers may be stored locally in your browser to make room management and re-entry smoother.",
  },
  {
    title: "3. Messages and encryption",
    body: "Messages are encrypted for transit and intended for ephemeral use. Session links include cryptographic context required to join a room.",
  },
  {
    title: "4. Media uploads",
    body: "Images and shared media are stored only to support active room usage. Cleanup routines remove files when rooms end or become inactive.",
  },
  {
    title: "5. Analytics",
    body: "We may use lightweight analytics to understand overall usage trends and improve reliability. We do not build advertising profiles.",
  },
  {
    title: "6. Your controls",
    body: "You can leave a room at any time, clear browser storage, and stop sharing links. If you need help or data clarifications, contact support.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Nullchat Legal"
      title="Privacy Policy"
      intro="This page explains how Nullchat handles privacy, temporary room data, and user safety controls."
      other={{ href: "/terms", label: "Read the Terms of Use" }}
      sections={sections}
    />
  );
}
