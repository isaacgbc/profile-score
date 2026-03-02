import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/blog — public: list published posts (no content body)
 */
export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        titleEs: true,
        description: true,
        descriptionEs: true,
        author: true,
        tags: true,
        readingTimeMin: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("GET /api/blog error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
