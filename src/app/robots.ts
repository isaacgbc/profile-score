import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/*", "/features", "/pricing"],
        disallow: ["/admin", "/admin/*", "/api", "/api/*", "/auth", "/auth/*", "/rewrite-studio", "/checkout", "/results", "/input"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
