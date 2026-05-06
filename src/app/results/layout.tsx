import type { Metadata } from "next";

// Results page shows user-specific audit data — must not be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
