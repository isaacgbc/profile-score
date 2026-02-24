import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";
import { UpdatePromptInput } from "@/lib/schemas/prompt";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const prompt = await prisma.promptRegistry.findUnique({
      where: { id },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("GET /api/prompts/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdatePromptInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.promptRegistry.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // If activating, archive any other active prompt with same key + locale
    if (parsed.data.status === "active") {
      await prisma.promptRegistry.updateMany({
        where: {
          promptKey: existing.promptKey,
          locale: existing.locale,
          status: "active",
          id: { not: id },
        },
        data: { status: "archived" },
      });
    }

    const updated = await prisma.promptRegistry.update({
      where: { id },
      data: {
        ...(parsed.data.content !== undefined && {
          content: parsed.data.content,
        }),
        ...(parsed.data.status !== undefined && {
          status: parsed.data.status,
        }),
        ...(parsed.data.modelTarget !== undefined && {
          modelTarget: parsed.data.modelTarget,
        }),
      },
    });

    return NextResponse.json({ prompt: updated });
  } catch (err) {
    console.error("PATCH /api/prompts/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
