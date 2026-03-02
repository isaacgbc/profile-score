import type { Metadata } from "next";
import LandingClient from "@/components/landing/LandingClient";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  title: "ProfileScore – Score de tu perfil LinkedIn y CV | Gratis",
  description:
    "Analizá tu perfil de LinkedIn y CV con IA. Conseguí un score unificado y mejorá tu presencia profesional. Gratis para empezar.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ProfileScore – Score de tu perfil LinkedIn y CV | Gratis",
    description:
      "Analizá tu perfil de LinkedIn y CV con IA. Conseguí un score unificado y mejorá tu presencia profesional. Gratis para empezar.",
    url: baseUrl,
    images: [{ url: "/brand/logo.png", width: 512, height: 512, alt: "Profile Score" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProfileScore – Score de tu perfil LinkedIn y CV | Gratis",
    description:
      "Analizá tu perfil de LinkedIn y CV con IA. Conseguí un score unificado y mejorá tu presencia profesional. Gratis para empezar.",
    images: ["/brand/logo.png"],
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
