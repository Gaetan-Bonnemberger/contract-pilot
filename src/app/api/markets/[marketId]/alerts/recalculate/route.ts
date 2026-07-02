import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { recalculateAlerts } from "@/lib/alerts";
import { PERMISSIONS } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { criticalAlertEmail } from "@/lib/email-templates";
import { marketCodeLabel } from "@/lib/market-code";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.alerts.recalculate(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;

  try {
    const count = await recalculateAlerts(marketId);

    await audit({
      userId: session.user.id,
      action: "ALERT_RECALCULATED",
      entityType: "Market",
      entityId: marketId,
      marketId,
      label: `Alertes recalculées : ${count} alerte(s) générée(s)`,
      details: { count },
    });

    // Notification email si des alertes critiques ont été générées
    if (count > 0) {
      void notifyCriticalAlerts(marketId);
    }

    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors du recalcul" },
      { status: 500 }
    );
  }
}

/** Envoi non-bloquant des alertes critiques au responsable du marché */
async function notifyCriticalAlerts(marketId: string) {
  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        responsibleUser: true,
        alerts: {
          where: { status: "OPEN", severity: "CRITIQUE" },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!market || !market.responsibleUser?.email) return;
    if (market.alerts.length === 0) return;

    await sendEmail({
      to: market.responsibleUser.email,
      subject: `🚨 ${market.alerts.length} alerte(s) critique(s) — ${marketCodeLabel(market.marketCode)}`,
      html: criticalAlertEmail({
        recipientName: `${market.responsibleUser.firstName} ${market.responsibleUser.lastName}`,
        marketCode: marketCodeLabel(market.marketCode),
        marketTitle: market.title,
        marketId: market.id,
        alerts: market.alerts.map((a) => ({
          alertType: a.alertType,
          severity: a.severity,
          cause: a.cause,
        })),
      }),
    });
  } catch (err) {
    console.error("[notifyCriticalAlerts] Erreur :", err);
  }
}
