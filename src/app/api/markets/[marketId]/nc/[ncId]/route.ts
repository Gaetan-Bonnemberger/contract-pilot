import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { canWrite } from "@/lib/permissions";

// ── PATCH /api/markets/:id/nc/:ncId ───────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ marketId: string; ncId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canWrite(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId, ncId } = await params;
  const body = await req.json();

  const existing = await prisma.nonConformite.findUnique({ where: { id: ncId } });
  if (!existing || existing.marketId !== marketId) {
    return NextResponse.json({ error: "NC introuvable" }, { status: 404 });
  }

  const updated = await prisma.nonConformite.update({
    where: { id: ncId },
    data: {
      description: body.description?.trim() ?? existing.description,
      rootCause: body.rootCause !== undefined ? (body.rootCause?.trim() || null) : existing.rootCause,
      correctiveAction: body.correctiveAction !== undefined
        ? (body.correctiveAction?.trim() || null)
        : existing.correctiveAction,
      status: body.status ?? existing.status,
      projectId: body.projectId !== undefined ? body.projectId : existing.projectId,
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      project: { select: { projectCode: true, siteName: true } },
    },
  });

  await audit({
    userId: session.user.id,
    action: "NC_UPDATED",
    entityType: "NonConformite",
    entityId: ncId,
    marketId,
    label: `NC mise à jour — ${updated.description.slice(0, 60)}`,
    details: { status: updated.status },
  });

  return NextResponse.json(updated);
}
