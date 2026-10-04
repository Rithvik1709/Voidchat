import type { Metadata } from "next";
import GroupList from "@/components/GroupList";

// The app itself is not a search landing page. noindex (not Disallow) so Google can read this tag.
export const metadata: Metadata = {
    title: "Your groups",
    robots: { index: false, follow: true },
};

export default function GroupsPage() {
    return (
        <main className="min-h-screen selection:bg-primary selection:text-primary-foreground">
            <GroupList />
        </main>
    );
}