import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { CommandPalette } from "@/components/command-palette";
import { DynamicTitle } from "@/components/dynamic-title";
import "./globals.css";

const pixelFont = localFont({
  src: "../public/pixelfont.woff2",
  variable: "--font-pixel",
  display: "swap",
});

// metadataBase lets Next.js resolve relative OG / Twitter image URLs to absolute
// ones (crawlers reject relative paths). Override via env per-environment so
// preview deployments don't claim the production canonical.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://design.md";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "design.md design specs as markdown",
    template: "%s · design.md",
  },
  description:
    "A markdown-first format for shipping design. Write the source of truth once render it as a doc, a system, or a prompt.",
  applicationName: "design.md",
  category: "developer tools",
  keywords: [
    "design system",
    "markdown",
    "design specs",
    "design tokens",
    "design docs",
  ],
  authors: [{ name: "design.md" }],
  creator: "design.md",
  publisher: "design.md",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "design.md design specs as markdown",
    description:
      "A markdown-first format for shipping design. Write the source of truth once render it as a doc, a system, or a prompt.",
    siteName: "design.md",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "design.md design specs as markdown",
    description: "Ship the spec, not the screenshot.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${pixelFont.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
      // Some browser extensions (locator devtools, dark-mode helpers, etc.)
      // inject attributes onto <html> before React hydrates  e.g.
      // `data-locator-client-url="chrome-extension://…"`. Suppress the
      // mismatch warning on the root element only; descendant mismatches
      // (which would be real bugs) still surface normally.
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-black text-white"
        // Same shape as the <html> case  password managers (Dashlane /
        // LastPass / Bitwarden / etc.) inject `__processed_<uuid>__="true"`
        // onto <body>. Suppress at the body level too.
        suppressHydrationWarning
      >
        <DynamicTitle />
        <CommandPalette />
        {children}
      </body>
    </html>
  );
}
