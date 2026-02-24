"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pricing is now a modal, redirect any direct visits to /results
export default function PricingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/results");
  }, [router]);
  return null;
}
