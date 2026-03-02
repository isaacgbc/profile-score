import type { Metadata } from "next";
import Link from "next/link";
import CompetitorTable from "@/components/landing/CompetitorTable";
import WhySection from "@/components/landing/WhySection";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  title: "ProfileScore vs Jobscan vs Careerflow | Comparativa",
  description:
    "Comparamos las mejores herramientas de optimización de perfiles. Descubrí por qué ProfileScore es diferente.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "ProfileScore vs Jobscan vs Careerflow | Comparativa",
    description:
      "Comparamos las mejores herramientas de optimización de perfiles. Descubrí por qué ProfileScore es diferente.",
    url: `${baseUrl}/compare`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProfileScore vs Jobscan vs Careerflow | Comparativa",
    description:
      "Comparamos las mejores herramientas de optimización de perfiles. Descubrí por qué ProfileScore es diferente.",
  },
};

export default function ComparePage() {
  return (
    <main className="bg-[var(--surface-secondary)] min-h-screen">
      {/* ─── Hero ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-6 text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)] border border-blue-100 mb-5">
          Comparativa
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4 leading-tight">
          ProfileScore vs Jobscan,<br className="hidden sm:block" /> Careerflow y más
        </h1>
        <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto">
          Datos concretos. Sin hype. Elegí la herramienta que realmente se adapta a tus objetivos profesionales.
        </p>
      </section>

      {/* ─── Main comparison table ─── */}
      <CompetitorTable />

      {/* ─── Why different ─── */}
      <WhySection />

      {/* ─── CTA ─── */}
      <section className="bg-white border-t border-[var(--border-light)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
            Probá ProfileScore gratis
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
            Score unificado de LinkedIn + CV. En español. En menos de 2 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors duration-150"
            >
              Empezar gratis
            </Link>
            <Link
              href="/why-profilescore"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[var(--text-primary)] font-semibold text-sm border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-150"
            >
              Por qué ProfileScore →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
