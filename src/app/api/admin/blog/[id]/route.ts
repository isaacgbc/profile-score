import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";

/**
 * GET /api/admin/blog/[id] — get a single post with full content
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await params;

  try {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (err) {
    console.error("GET /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/blog/[id] — update a post
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json();
    const { slug, title, titleEs, description, descriptionEs, content, contentEs, author, tags, readingTimeMin, published } = body;

    // If slug changed, check uniqueness
    if (slug) {
      const existing = await prisma.blogPost.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(titleEs !== undefined ? { titleEs } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(descriptionEs !== undefined ? { descriptionEs } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(contentEs !== undefined ? { contentEs } : {}),
        ...(author !== undefined ? { author } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(readingTimeMin !== undefined ? { readingTimeMin } : {}),
        ...(published !== undefined ? { published } : {}),
      },
    });

    return NextResponse.json({ post });
  } catch (err) {
    console.error("PUT /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/blog/[id] — delete a post
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await params;

  try {
    await prisma.blogPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/blog/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
