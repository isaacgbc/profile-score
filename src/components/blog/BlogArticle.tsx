"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { BlogPost } from "@/lib/blog/posts";

export default function BlogArticle({ post }: { post: BlogPost }) {
  const { locale } = useI18n();
  const blogT = (locale === "es"
    ? { backToBlog: "Volver al Blog", readingTime: "min de lectura", publishedOn: "Publicado el", updatedOn: "Actualizado el", blogCta: "Evaluar Mi Perfil Gratis" }
    : { backToBlog: "Back to Blog", readingTime: "min read", publishedOn: "Published on", updatedOn: "Updated on", blogCta: "Score My Profile Free" });

  const title = locale === "es" ? post.titleEs : post.title;
  const content = locale === "es" ? post.contentEs : post.content;
  const pubDate = new Date(post.publishedAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const updDate = new Date(post.updatedAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <Link href="/blog" className="text-sm text-[var(--accent)] hover:underline">
          ← {blogT.backToBlog}
        </Link>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="free" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] tracking-tight leading-tight mb-4">
          {title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mb-8 pb-8 border-b border-[var(--border-light)]">
          <span>{post.author}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
          <span>{blogT.publishedOn} {pubDate}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
          <span>{blogT.updatedOn} {updDate}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
          <span>{post.readingTimeMin} {blogT.readingTime}</span>
        </div>

        {/* Content */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl bg-[var(--accent-light)] border border-[var(--accent)]/10 text-center">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
            {locale === "es" ? "¿Listo para optimizar tu perfil?" : "Ready to optimize your profile?"}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {locale === "es"
              ? "Obtén tu puntuación gratis en menos de 2 minutos."
              : "Get your free score in under 2 minutes."}
          </p>
          <Link href="/features">
            <Button size="lg">{blogT.blogCta}</Button>
          </Link>
        </div>
      </article>
    </div>
  );
}
