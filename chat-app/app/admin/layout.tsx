import type { Metadata } from "next";

// Never list the admin area in search results (it is also blocked in robots.txt)
export const metadata: Metadata = {
    title: "Admin",
    robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return children;
}
