import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { applyNcImpactToKpi } from "@/lib/nc";

// ── POST /api/markets/:id/nc/:ncId/close ──────────────────────────────────
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ marketId: string; ncId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Fermeture réservée aux RESPONSABLE_MARCHE et au-dessus
  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId, ncId } = await params;

  const nc = await prisma.nonConformite.findUnique({ where: { id: ncId } });
  if (!nc || nc.marketId !== marketId) {
    return NextResponse.json({ error: "NC introuvable" }, { status: 404 });
  }
  if (nc.status === "CLOTUREE") {
    return NextResponse.json({ error: "NC déjà clôturée" }, { status: 400 });
  }

  const closed = await prisma.nonConformite.update({
    where: { id: ncId },
    data: { status: "CLOTUREE", closedAt: new Date() },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      project: { select: { projectCode: true, siteName: true } },
    },
  });

  // Restituer l'impact sur le KPI (on remet les points)
  const impact = Number(nc.scoreImpact);
  if (impact > 0) {
    await applyNcImpactToKpi(marketId, nc.ncType, +impact);
  }

  await audit({
    userId: session.user.id,
    action: "NC_CLOSED",
    entityType: "NonConformite",
    entityId: ncId,
    marketId,
    label: `NC clôturée — ${nc.description.slice(0, 60)}`,
    details: { scoreRestored: impact },
  });

  return NextResponse.json(closed);
}
