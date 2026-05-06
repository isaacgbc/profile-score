import type { Metadata } from "next";

// Input page is the app entry form — disallowed in robots.txt and noindexed for belt-and-suspenders.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function InputLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
