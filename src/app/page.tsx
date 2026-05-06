import type { Metadata } from "next";
import LandingClient from "@/components/landing/LandingClient";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  title: "Profile Score — AI-Powered LinkedIn + CV Optimization | Free",
  description:
    "Score your LinkedIn profile and CV instantly with AI. Get a unified score, section-by-section audits, and professional rewrites. Available in English and Spanish. Free to start.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization | Free",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get a unified score, section-by-section audits, and professional rewrites. Available in English and Spanish.",
    url: baseUrl,
    images: [{ url: "/brand/logo.png", width: 1000, height: 1000, alt: "Profile Score" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization | Free",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get a unified score, section-by-section audits, and professional rewrites. Available in English and Spanish.",
    images: ["/brand/logo.png"],
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
