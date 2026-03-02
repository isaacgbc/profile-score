"use client";

import { useEffect } from "react";
import { trackEvent, hasTrackedThisSession, markTrackedThisSession } from "@/lib/analytics/tracker";

import HeroSection from "./HeroSection";
import LiveDemo from "./LiveDemo";
import StatsRow from "./StatsRow";
import ValueCards from "./ValueCards";
import ATSWarning from "./ATSWarning";
import FeaturesGrid from "./FeaturesGrid";
import WhySection from "./WhySection";
import ComparisonSection from "./ComparisonSection";
import CompetitorTable from "./CompetitorTable";
import SocialProofSection from "./SocialProofSection";
import CaseStudiesSection from "./CaseStudiesSection";
import TrustMarquee from "./TrustMarquee";
import HowItWorksSection from "./HowItWorksSection";
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
      <HeroSection />
      <LiveDemo />
      <StatsRow />
      <ValueCards />
      <ATSWarning />
      <FeaturesGrid />
      <WhySection />
      <ComparisonSection />
      <CompetitorTable />
      <SocialProofSection />
      <CaseStudiesSection />
      <TrustMarquee />
      <HowItWorksSection />
      <FAQSection />
      <BottomCTA />
    </div>
  );
}
