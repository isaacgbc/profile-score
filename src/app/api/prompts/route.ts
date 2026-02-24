import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";
import { CreatePromptInput } from "@/lib/schemas/prompt";

export async function GET(request: Request) {
  // Admin guard
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const locale = url.searchParams.get("locale");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (key) where.promptKey = key;
    if (locale) where.locale = locale;
    if (status) where.status = status;

    const prompts = await prisma.promptRegistry.findMany({
      where,
      orderBy: [{ promptKey: "asc" }, { version: "desc" }],
    });

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("GET /api/prompts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Admin guard
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = CreatePromptInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { promptKey, locale, modelTarget, content } = parsed.data;

    // Determine next version number
    const latest = await prisma.promptRegistry.findFirst({
      where: { promptKey, locale },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const prompt = await prisma.promptRegistry.create({
      data: {
        promptKey,
        version: nextVersion,
        locale,
        modelTarget: modelTarget ?? null,
        content,
        status: "draft",
      },
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (err) {
    console.error("POST /api/prompts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
