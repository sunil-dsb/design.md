import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const pixelFont = localFont({
  src: "../public/pixelfont.woff2",
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "design.md design specs as markdown",
    template: "%s · design.md",
  },
  description:
    "A markdown-first format for shipping design. Write the source of truth once render it as a doc, a system, or a prompt.",
  keywords: [
    "design system",
    "markdown",
    "design specs",
    "design tokens",
    "design docs",
  ],
  authors: [{ name: "design.md" }],
  creator: "design.md",
  openGraph: {
    type: "website",
    title: "design.md design specs as markdown",
    description:
      "A markdown-first format for shipping design. Write the source of truth once render it as a doc, a system, or a prompt.",
    siteName: "design.md",
  },
  twitter: {
    card: "summary_large_image",
    title: "design.md design specs as markdown",
    description: "Ship the spec, not the screenshot.",
  },
  robots: {
    index: true,
    follow: true,
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
      className={`${geistSans.variable} ${pixelFont.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
      // Some browser extensions (locator devtools, dark-mode helpers, etc.)
      // inject attributes onto <html> before React hydrates — e.g.
      // `data-locator-client-url="chrome-extension://…"`. Suppress the
      // mismatch warning on the root element only; descendant mismatches
      // (which would be real bugs) still surface normally.
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-black text-white"
        // Same shape as the <html> case — password managers (Dashlane /
        // LastPass / Bitwarden / etc.) inject `__processed_<uuid>__="true"`
        // onto <body>. Suppress at the body level too.
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
