import type { Metadata } from "next";

// Rewrite studio shows user-specific AI rewrites — must not be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RewriteStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
