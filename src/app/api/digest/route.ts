import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { dailyDigestEmail } from "@/lib/email-templates";
import { marketCodeLabel } from "@/lib/market-code";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * POST /api/digest
 * Envoie le récapitulatif quotidien à tous les ADMIN et DIRECTEUR.
 * Accessible uniquement aux ADMIN.
 */
export async function POST(_req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  try {
    // Récupérer tous les marchés actifs avec leurs alertes et scores
    const markets = await prisma.market.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: {
        alerts: { where: { status: "OPEN" } },
        scores: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
      orderBy: { marketCode: "asc" },
    });

    // Destinataires : ADMIN + DIRECTEUR actifs avec email
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "DIRECTEUR"] },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (recipients.length === 0) {
      return NextResponse.json({ sent: 0, reason: "Aucun destinataire trouvé" });
    }

    const dateLabel = format(new Date(), "d MMMM yyyy", { locale: fr });

    const digestMarkets = markets.map((m) => {
      const criticalAlerts = m.alerts.filter((a) => a.severity === "CRITIQUE").length;
      const majorAlerts = m.alerts.filter((a) => a.severity === "MAJEUR").length;
      const latestScore = m.scores[0];
      const score = latestScore ? Number(latestScore.scoreValue) : null;

      return {
        marketCode: marketCodeLabel(m.marketCode),
        marketTitle: m.title,
        marketId: m.id,
        criticalAlerts,
        majorAlerts,
        score,
      };
    });

    const totalCritical = digestMarkets.reduce((s, m) => s + m.criticalAlerts, 0);
    const totalOpen = markets.reduce((s, m) => s + m.alerts.length, 0);

    let sent = 0;
    for (const recipient of recipients) {
      const ok = await sendEmail({
        to: recipient.email,
        subject: `📋 Récapitulatif Contract Pilot — ${dateLabel}`,
        html: dailyDigestEmail({
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          date: dateLabel,
          markets: digestMarkets,
          totalCritical,
          totalOpen,
        }),
      });
      if (ok) sent++;
    }

    return NextResponse.json({ sent, recipients: recipients.length, markets: markets.length });
  } catch (error) {
    console.error("[digest] Erreur :", error);
    return NextResponse.json({ error: "Erreur lors de l'envoi du digest" }, { status: 500 });
  }
}
