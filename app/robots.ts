import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://design.md";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /extract renders user-supplied URLs in the query string; we don't
        // want crawlers indexing every variant of that endpoint as a unique
        // page. The landing page covers the intent.
        disallow: ["/extract"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
