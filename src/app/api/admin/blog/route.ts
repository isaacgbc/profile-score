import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";

/**
 * GET /api/admin/blog — list all posts (admin sees drafts too)
 */
export async function GET(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const posts = await prisma.blogPost.findMany({
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
        published: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("GET /api/admin/blog error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/blog — create a new post
 */
export async function POST(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { slug, title, titleEs, description, descriptionEs, content, contentEs, author, tags, readingTimeMin, published } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
    }

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title,
        titleEs: titleEs ?? "",
        description: description ?? "",
        descriptionEs: descriptionEs ?? "",
        content: content ?? "",
        contentEs: contentEs ?? "",
        author: author ?? "Profile Score Team",
        tags: tags ?? [],
        readingTimeMin: readingTimeMin ?? 5,
        published: published ?? false,
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/blog error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
