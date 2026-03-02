import type { Metadata } from "next";
import Link from "next/link";
import WhySection from "@/components/landing/WhySection";
import CompetitorTable from "@/components/landing/CompetitorTable";

export const metadata: Metadata = {
  title: "Por qué ProfileScore – Diferente por diseño",
  description:
    "ProfileScore es más que una herramienta ATS: analiza LinkedIn y CV juntos, habla español, y sirve tanto para buscar trabajo como para atraer clientes. Conocé las diferencias.",
  alternates: { canonical: "/why-profilescore" },
  openGraph: {
    title: "Por qué ProfileScore – Diferente por diseño",
    description:
      "Score unificado, optimización para freelancers e interfaz en español. Todo lo que otras herramientas no tienen.",
    url: "/why-profilescore",
  },
};

export default function WhyProfileScorePage() {
  return (
    <main className="bg-[var(--surface-secondary)] min-h-screen">
      {/* ─── Hero ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-6 text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)] border border-blue-100 mb-5">
          Por qué ProfileScore
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4 leading-tight">
          Diferente por diseño,<br className="hidden sm:block" /> no por marketing
        </h1>
        <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto">
          Hay muchas herramientas de optimización de perfiles. Esta es la única pensada para
          construir tu presencia profesional completa — no solo para conseguir entrevistas.
        </p>
      </section>

      {/* ─── 3 Differentiation Points ─── */}
      <WhySection />

      {/* ─── Competitor Table ─── */}
      <CompetitorTable />

      {/* ─── CTA ─── */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
          ¿Convencido? Probá gratis.
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Sin tarjeta de crédito. Sin registro. Resultados en menos de 2 minutos.
        </p>
        <Link
          href="/features"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors duration-150"
        >
          Evaluar mi perfil gratis
        </Link>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Únete a 50,000+ profesionales que ya optimizaron su presencia.
        </p>
      </section>
    </main>
  );
}
