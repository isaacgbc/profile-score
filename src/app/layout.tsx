import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    template: "%s | Profile Score",
    default: "Profile Score — AI-Powered LinkedIn + CV Optimization",
  },
  description:
    "Score your LinkedIn profile and CV instantly with AI. Get section-by-section audits, ATS-optimized rewrites, and professional exports. Trusted by 50,000+ professionals.",
  keywords: [
    "linkedin optimization",
    "cv score",
    "resume score",
    "ats resume checker",
    "linkedin profile audit",
    "cv rewrite",
    "resume optimization",
    "ats optimization",
    "career optimization tool",
    "linkedin profile score",
    "professional profile analysis",
    "resume checker free",
    "linkedin audit tool",
    "cv optimization ai",
    "profile score",
  ],
  authors: [{ name: "Profile Score" }],
  creator: "Profile Score",
  publisher: "Profile Score",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/brand/logo.svg", type: "image/svg+xml" },
      { url: "/brand/logo.png", type: "image/png" },
    ],
    apple: { url: "/brand/logo.png", type: "image/png" },
  },
  openGraph: {
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get section-by-section audits, ATS-optimized rewrites, and professional exports.",
    images: [{ url: "/brand/logo.png", width: 512, height: 512, alt: "Profile Score" }],
    type: "website",
    siteName: "Profile Score",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get section-by-section audits, ATS-optimized rewrites, and professional exports.",
    images: ["/brand/logo.png"],
  },
};

// JSON-LD structured data for GEO and rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Profile Score",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "AI-powered LinkedIn and CV optimization tool. Get instant profile scoring, section-by-section audits, professional rewrites, and ATS-optimized exports.",
      url: baseUrl,
      offers: [
        {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          name: "Free",
          description: "Overall profile score and tier rating",
        },
        {
          "@type": "Offer",
          price: "5",
          priceCurrency: "USD",
          name: "Starter",
          description: "Full audit + rewrites for LinkedIn or CV",
        },
        {
          "@type": "Offer",
          price: "10",
          priceCurrency: "USD",
          name: "Complete",
          description: "LinkedIn + CV together, plus cover letter generation",
        },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "2340",
        bestRating: "5",
        worstRating: "1",
      },
      featureList: [
        "AI-powered profile scoring",
        "Section-by-section audit",
        "Professional rewrites",
        "ATS optimization",
        "Cover letter generation",
        "PDF and DOCX export",
        "LinkedIn profile analysis",
        "CV/Resume rewrite",
      ],
    },
    {
      "@type": "Organization",
      name: "Profile Score",
      url: baseUrl,
      logo: `${baseUrl}/brand/logo.png`,
      description: "AI-powered LinkedIn and CV optimization platform.",
    },
    {
      "@type": "WebSite",
      name: "Profile Score",
      url: baseUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/blog?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={outfit.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
