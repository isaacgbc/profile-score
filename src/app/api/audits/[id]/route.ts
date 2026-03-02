import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/audits/:id
 *
 * Returns stored audit results by ID.
 * Used for post-payment restoration: user completes checkout on Crea.la,
 * gets redirected back, and we restore their audit from the DB.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || id.length < 10) {
      return NextResponse.json({ error: "Invalid audit ID" }, { status: 400 });
    }

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: {
        id: true,
        results: true,
        planId: true,
        userInput: true,
        modelUsed: true,
        promptVersions: true,
        createdAt: true,
      },
    });

    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    return NextResponse.json(audit);
  } catch (err) {
    console.error("GET /api/audits/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
