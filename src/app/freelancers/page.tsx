import type { Metadata } from "next";
import Link from "next/link";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://profilescore.app";

export const metadata: Metadata = {
  title: "LinkedIn para Freelancers | Atraé clientes con tu perfil",
  description:
    "Optimizá tu LinkedIn para conseguir clientes, no solo empleos. ProfileScore analiza tu perfil desde la perspectiva de quien te busca para contratar.",
  alternates: { canonical: "/freelancers" },
  keywords: [
    "linkedin freelancers",
    "perfil linkedin freelance",
    "optimizar linkedin clientes",
    "profile score freelance",
    "conseguir clientes linkedin",
    "presencia profesional freelance",
    "linkedin latam freelance",
  ],
  openGraph: {
    title: "LinkedIn para Freelancers | Atraé clientes con tu perfil",
    description:
      "Optimizá tu LinkedIn para conseguir clientes, no solo empleos. ProfileScore analiza tu perfil desde la perspectiva de quien te busca para contratar.",
    url: `${baseUrl}/freelancers`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkedIn para Freelancers | Atraé clientes con tu perfil",
    description:
      "Optimizá tu LinkedIn para conseguir clientes, no solo empleos. ProfileScore analiza tu perfil desde la perspectiva de quien te busca para contratar.",
  },
};

const benefits = [
  {
    icon: "👁️",
    title: "Visibilidad ante quien paga",
    desc: "Analizamos tu perfil como lo vería un potencial cliente, no un reclutador. La diferencia es enorme: las señales que atraen contratos son distintas a las que atraen empleos.",
  },
  {
    icon: "🎯",
    title: "Score desde la perspectiva del cliente",
    desc: "Nuestro análisis freelance mide credibilidad, claridad de oferta y señales de confianza — los factores que hacen que alguien diga \u201cquiero contratar a esta persona\u201d.",
  },
  {
    icon: "💬",
    title: "Reescrituras orientadas a conversión",
    desc: "Tu headline, tu About y tu experiencia reescritos para generar inbound. Porque tu perfil es tu propuesta de valor, no tu historial laboral.",
  },
  {
    icon: "🌎",
    title: "Pensado para LATAM y España",
    desc: "El mercado freelance hispanohablante tiene sus propios patrones. ProfileScore entiende el contexto local y adapta las recomendaciones a tu mercado.",
  },
];

export default function FreelancersPage() {
  return (
    <main className="bg-[var(--surface-secondary)] min-h-screen">
      {/* ─── Hero ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-6 text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)] border border-blue-100 mb-5">
          Para Freelancers
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4 leading-tight">
          Tu LinkedIn no es un CV.<br className="hidden sm:block" /> Es tu canal de ventas.
        </h1>
        <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto">
          Jobscan y Careerflow están diseñados para conseguir empleos. ProfileScore tiene un modo
          específico para freelancers: optimizamos tu perfil para que clientes te encuentren y confíen en vos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link
            href="/features"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors duration-150"
          >
            Optimizar mi perfil freelance
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[var(--text-primary)] font-semibold text-sm border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-150"
          >
            Ver comparativa →
          </Link>
        </div>
      </section>

      {/* ─── Benefits grid ─── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid sm:grid-cols-2 gap-5">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="bg-white border border-[var(--border)] rounded-2xl p-6 flex gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="text-2xl shrink-0 mt-0.5">{b.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{b.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Quote callout ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-[var(--accent-light)] border border-blue-100 rounded-2xl p-8 text-center">
          <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic mb-4">
            &ldquo;Si tu LinkedIn no explica claramente qué problema solucionás y para quién,
            los clientes potenciales siguen de largo — sin importar lo bueno que seas.&rdquo;
          </p>
          <p className="text-xs text-[var(--text-muted)]">— Principio de posicionamiento freelance</p>
        </div>
      </section>

      {/* ─── Stats row ─── */}
      <section className="bg-white border-y border-[var(--border-light)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "50K+", label: "Perfiles analizados" },
            { value: "+40", label: "Puntos de mejora promedio" },
            { value: "3×", label: "Más contactos inbound" },
            { value: "<2 min", label: "Para tu score gratis" },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-bold text-[var(--accent)] tracking-tight">{s.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
          Gratis para empezar
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          Score en menos de 2 minutos. Sin registro. Sin tarjeta de crédito.
        </p>
        <Link
          href="/features"
          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors duration-150"
        >
          Evaluar mi perfil freelance
        </Link>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Únete a 50,000+ profesionales que ya optimizaron su presencia.
        </p>
      </section>
    </main>
  );
}
