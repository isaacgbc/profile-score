"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { BlogPost } from "@/lib/blog/posts";

export default function BlogPostCard({ post }: { post: BlogPost }) {
  const { locale, t } = useI18n();
  const blogT = t.common as Record<string, string>;
  const title = locale === "es" ? post.titleEs : post.title;
  const description = locale === "es" ? post.descriptionEs : post.description;

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <Card variant="default" padding="lg" hoverable className="h-full flex flex-col">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="free" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent)] transition-colors leading-snug">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">
          {description}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{post.readingTimeMin} {blogT.minutes ?? "min"}</span>
          <span>{new Date(post.publishedAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
      </Card>
    </Link>
  );
}
