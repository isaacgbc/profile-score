import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  title: "Features — AI LinkedIn & CV Audit",
  description:
    "Discover ProfileScore features: AI-powered section-by-section audits, professional rewrites, ATS-optimized CV exports, and cover letter generation. Start free.",
  alternates: {
    canonical: `${baseUrl}/features`,
  },
  openGraph: {
    title: "Features — AI LinkedIn & CV Audit | Profile Score",
    description:
      "AI-powered LinkedIn + CV audits, professional rewrites, ATS exports, and cover letter generation. Available in English and Spanish.",
    url: `${baseUrl}/features`,
    type: "website",
    images: [{ url: `${baseUrl}/brand/logo.png`, width: 1000, height: 1000, alt: "Profile Score" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Features — AI LinkedIn & CV Audit | Profile Score",
    description:
      "AI-powered LinkedIn + CV audits, professional rewrites, ATS exports, and cover letter generation.",
    images: [`${baseUrl}/brand/logo.png`],
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
