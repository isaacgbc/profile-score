import type { Metadata } from "next";

// Checkout page shows user-specific plan/export state — must not be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
