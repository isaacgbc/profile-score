import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { CreateAuditInput } from "@/lib/schemas/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateAuditInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const audit = await prisma.audit.create({
      data: {
        results: parsed.data.results as Prisma.InputJsonValue,
        planId: parsed.data.planId ?? null,
      },
    });

    return NextResponse.json({ auditId: audit.id });
  } catch (err) {
    console.error("POST /api/audits error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
