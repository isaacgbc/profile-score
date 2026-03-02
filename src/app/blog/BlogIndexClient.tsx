"use client";

import { useI18n } from "@/context/I18nContext";
import BlogPostCard from "@/components/blog/BlogPostCard";
import type { BlogPost } from "@/lib/blog/posts";

export default function BlogIndexClient({ posts }: { posts: BlogPost[] }) {
  const { locale } = useI18n();

  const title = locale === "es" ? "Blog" : "Blog";
  const subtitle =
    locale === "es"
      ? "Consejos de expertos sobre optimización de LinkedIn, CVs compatibles con ATS y crecimiento profesional."
      : "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth.";

  return (
    <div className="animate-fade-in max-w-5xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-3 animate-slide-up">
        {title}
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mb-12 max-w-2xl animate-slide-up" style={{ animationDelay: "60ms" }}>
        {subtitle}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post, i) => (
          <div key={post.slug} className="animate-slide-up" style={{ animationDelay: `${(i + 1) * 80}ms` }}>
            <BlogPostCard post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
