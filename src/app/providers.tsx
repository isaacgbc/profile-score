"use client";

import { type ReactNode } from "react";
import { I18nProvider } from "@/context/I18nContext";
import { AppProvider } from "@/context/AppContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AdminBanner from "@/components/layout/AdminBanner";
import BugReportOverlay from "@/components/feedback/BugReportOverlay";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AppProvider>
        <div className="min-h-screen flex flex-col">
          <AdminBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BugReportOverlay />
        </div>
      </AppProvider>
    </I18nProvider>
  );
}
