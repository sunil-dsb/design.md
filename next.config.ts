import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `playwright` and `playwright-core` are already in Next.js's default
  // server-external opt-out list. Adding the three our engine uses that aren't:
  serverExternalPackages: [
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "css-tree",
  ],
};

export default nextConfig;
