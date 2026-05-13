import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";

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

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  return NextResponse.json(alert);
}
