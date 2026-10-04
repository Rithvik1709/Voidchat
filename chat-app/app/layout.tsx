import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import ClientMonitor from "@/components/ClientMonitor";
import { Analytics } from "@vercel/analytics/next";
import { SITE, SITE_URL } from "@/lib/site";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    // Pages set their own title; this adds the brand to it ("About | Nullchat")
    title: { default: SITE.title, template: `%s | ${SITE.name}` },
    description: SITE.description,
    applicationName: SITE.name,
    keywords: [...SITE.keywords],
    authors: [{ name: SITE.name, url: SITE_URL }],
    creator: SITE.name,
    publisher: SITE.name,
    category: "communication",
    openGraph: {
        type: "website",
        siteName: SITE.name,
        locale: SITE.locale,
        title: SITE.title,
        description: SITE.description,
    },
    twitter: {
        card: "summary_large_image",
        title: SITE.title,
        description: SITE.description,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    // Paste the token from Google Search Console into NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
        ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
        : undefined,
    formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    interactiveWidget: "resizes-content",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AnalyticsTracker />
                    <ClientMonitor />
                    {children}
                </ThemeProvider>
                <Analytics />
            </body>
        </html>
    );
}
