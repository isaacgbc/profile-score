import type { Metadata } from "next";
import PricingClient from "@/components/pricing/PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Profile Score | One-Time Plans from $5",
  description:
    "Unlock detailed LinkedIn audits, professional CV rewrites, and ATS-optimized exports. One-time payment, no subscription. Start free, upgrade when you're ready.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — Profile Score",
    description:
      "One-time plans from $5. LinkedIn audit, CV rewrite, cover letter, and full export modules.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pricing — Profile Score",
    description:
      "One-time plans from $5. LinkedIn audit, CV rewrite, cover letter, and full export modules.",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
