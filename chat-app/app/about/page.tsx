import type { Metadata } from "next";
import AboutPageContent from "@/components/AboutPageContent";

export const metadata: Metadata = {
    title: "About Nullchat — Private, Ephemeral Group Chat",
    description:
        "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
    openGraph: {
        title: "About Nullchat — Private, Ephemeral Group Chat",
        description:
            "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
        url: "/about",
        siteName: "Nullchat",
        type: "website",
    },
    twitter: {
        card: "summary",
        title: "About Nullchat — Private, Ephemeral Group Chat",
        description:
            "Nullchat is a privacy-first group chat where messages are ephemeral and identity is temporary. Create rooms, invite instantly, and stay anonymous.",
    },
};

export default function AboutPage() {
    return <AboutPageContent />;
}
