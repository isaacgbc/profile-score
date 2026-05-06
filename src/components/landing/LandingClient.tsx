"use client";

import { useEffect } from "react";
import { trackEvent, hasTrackedThisSession, markTrackedThisSession } from "@/lib/analytics/tracker";

import HeroSection from "./HeroSection";
import LiveDemo from "./LiveDemo";
import ValueCards from "./ValueCards";
import FeaturesGrid from "./FeaturesGrid";
import HowItWorksSection from "./HowItWorksSection";
import ComparisonSection from "./ComparisonSection";
import CaseStudiesSection from "./CaseStudiesSection";
import FAQSection from "./FAQSection";
import BottomCTA from "./BottomCTA";

export default function LandingClient() {
  // ── Analytics: landing_view (deduped per browser session) ──
  useEffect(() => {
    if (!hasTrackedThisSession("landing_view")) {
      trackEvent("landing_view", { locale: "en" });
      markTrackedThisSession("landing_view");
    }
  }, []);

  return (
    <div className="animate-fade-in relative">
      {/* 1. Hero with dual CTAs */}
      <HeroSection />
      {/* 2. Interactive 4-stage demo */}
      <LiveDemo />
      {/* 3. Stats + Value propositions (merged) */}
      <ValueCards />
      {/* 4. Feature benefits grid */}
      <FeaturesGrid />
      {/* 5. How it works — 3 steps */}
      <HowItWorksSection />
      {/* 6. Free vs Paid comparison */}
      <ComparisonSection />
      {/* 7. Case studies — before/after transformations */}
      <CaseStudiesSection />
      {/* 8. FAQ with JSON-LD */}
      <FAQSection />
      {/* 9. Final CTA with social proof */}
      <BottomCTA />
    </div>
  );
}
