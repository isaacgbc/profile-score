import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/services/admin-guard";
import { prisma } from "@/lib/db/client";

/**
 * PATCH /api/admin/errors/[id]
 * Update an error log: toggle resolved, add notes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (typeof body.resolved === "boolean") data.resolved = body.resolved;
    if (typeof body.notes === "string") data.notes = body.notes.slice(0, 2000);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.errorLog.update({
      where: { id },
      data,
    });

    return NextResponse.json({ error: updated });
  } catch (err) {
    console.error("PATCH /api/admin/errors/[id]:", err);
    return NextResponse.json({ error: "Failed to update error log." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/errors/[id]
 * Delete a single error log entry.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.errorLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/errors/[id]:", err);
    return NextResponse.json({ error: "Failed to delete error log." }, { status: 500 });
  }
}
