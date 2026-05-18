import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

// ── PATCH /api/markets/:id/avenants/:avenantId ─────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ marketId: string; avenantId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId, avenantId } = await params;
  const body = await req.json();

  const existing = await prisma.avenant.findUnique({ where: { id: avenantId } });
  if (!existing || existing.marketId !== marketId) {
    return NextResponse.json({ error: "Avenant introuvable" }, { status: 404 });
  }

  const updated = await prisma.avenant.update({
    where: { id: avenantId },
    data: {
      nature: body.nature ?? existing.nature,
      signedAt: body.signedAt !== undefined
        ? (body.signedAt ? new Date(body.signedAt) : null)
        : existing.signedAt,
      deltaAmountHt: body.deltaAmountHt !== undefined ? body.deltaAmountHt : existing.deltaAmountHt,
      deltaDelayDays: body.deltaDelayDays !== undefined ? body.deltaDelayDays : existing.deltaDelayDays,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  await audit({
    userId: session.user.id,
    action: "AVENANT_UPDATED",
    entityType: "Avenant",
    entityId: avenantId,
    marketId,
    label: `Avenant n°${existing.avenantNumber} mis à jour`,
    details: { status: updated.status },
  });

  return NextResponse.json(updated);
}

// ── DELETE /api/markets/:id/avenants/:avenantId ────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ marketId: string; avenantId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId, avenantId } = await params;

  const existing = await prisma.avenant.findUnique({ where: { id: avenantId } });
  if (!existing || existing.marketId !== marketId) {
    return NextResponse.json({ error: "Avenant introuvable" }, { status: 404 });
  }

  await prisma.avenant.delete({ where: { id: avenantId } });

  await audit({
    userId: session.user.id,
    action: "AVENANT_DELETED",
    entityType: "Avenant",
    entityId: avenantId,
    marketId,
    label: `Avenant n°${existing.avenantNumber} supprimé`,
  });

  return NextResponse.json({ ok: true });
}
