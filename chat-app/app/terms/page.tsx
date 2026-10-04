import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use — Nullchat",
  description:
    "Terms governing use of Nullchat, including acceptable use, room ownership, and limitations.",
};

const sections: LegalSection[] = [
  {
    title: "1. Acceptance of terms",
    body: "By using Nullchat, you agree to these terms and applicable laws. If you do not agree, do not use the service.",
  },
  {
    title: "2. Acceptable use",
    body: "Do not use Nullchat for unlawful, abusive, or harmful behavior. You are responsible for content shared in rooms you create or join.",
  },
  {
    title: "3. Room lifecycle",
    body: "Rooms are ephemeral by design. Content may be deleted automatically when a room ends or becomes inactive.",
  },
  {
    title: "4. Availability",
    body: "We aim for reliable uptime but cannot guarantee uninterrupted availability. Features may change or be removed.",
  },
  {
    title: "5. Limitation of liability",
    body: "Nullchat is provided as-is. To the extent allowed by law, we are not liable for indirect, incidental, or consequential damages.",
  },
  {
    title: "6. Contact",
    body: "For legal or support questions, reach out to support@nullchat.tech.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      label="Nullchat Legal"
      title="Terms of Use"
      intro="These terms describe the rules and responsibilities for using Nullchat."
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
      sections={sections}
    />
  );
}
