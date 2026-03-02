import { prisma } from "@/lib/db/client";

export interface BlogPost {
  slug: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  content: string;
  contentEs: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  readingTimeMin: number;
}

function toPost(row: {
  slug: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  content: string;
  contentEs: string;
  author: string;
  publishedAt: Date;
  updatedAt: Date;
  tags: string[];
  readingTimeMin: number;
}): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    titleEs: row.titleEs,
    description: row.description,
    descriptionEs: row.descriptionEs,
    content: row.content,
    contentEs: row.contentEs,
    author: row.author,
    publishedAt: row.publishedAt.toISOString().slice(0, 10),
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
    tags: row.tags,
    readingTimeMin: row.readingTimeMin,
  };
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const rows = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(toPost);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const row = await prisma.blogPost.findUnique({ where: { slug } });
  if (!row || !row.published) return undefined;
  return toPost(row);
}

export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
  const rows = await prisma.blogPost.findMany({
    where: {
      published: true,
      tags: { has: tag },
    },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(toPost);
}

/**
 * Get all published slugs (for generateStaticParams).
 */
export async function getAllSlugs(): Promise<string[]> {
  const rows = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
