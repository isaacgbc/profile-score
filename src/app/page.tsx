import type { Metadata } from "next";
import LandingClient from "@/components/landing/LandingClient";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get section-by-section audits, ATS-optimized rewrites, and professional exports.",
    url: baseUrl,
    images: [{ url: "/brand/logo.png", width: 512, height: 512, alt: "Profile Score" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profile Score — AI-Powered LinkedIn + CV Optimization",
    description:
      "Score your LinkedIn profile and CV instantly with AI. Get section-by-section audits, ATS-optimized rewrites, and professional exports.",
    images: ["/brand/logo.png"],
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
