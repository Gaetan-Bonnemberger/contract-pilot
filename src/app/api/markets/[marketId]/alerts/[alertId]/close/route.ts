import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ marketId: string; alertId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.alerts.close(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { alertId } = await params;

  const { marketId } = await params;

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: { status: "CLOSED", closedAt: new Date() },
    include: { market: { select: { marketCode: true } } },
  });

  await audit({
    userId: session.user.id,
    action: "ALERT_CLOSED",
    entityType: "Alert",
    entityId: alertId,
    marketId,
    label: `Alerte clôturée : ${alert.alertType.replace(/_/g, " ")} sur ${alert.market.marketCode}`,
    details: { alertType: alert.alertType, severity: alert.severity },
  });

  return NextResponse.json(alert);
}
