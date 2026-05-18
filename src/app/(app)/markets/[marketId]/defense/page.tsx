import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { calculateMarketScore, METRIC_LABELS } from "@/lib/score";
import { DefenseClient } from "./defense-client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function DefensePage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const session = await auth();
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      marketCode: true,
      title: true,
      clientName: true,
      startDate: true,
      endDate: true,
      responsibleUser: { select: { firstName: true, lastName: true } },
    },
  });
  if (!market) notFound();

  const [scoreResult, defenseNotes] = await Promise.all([
    calculateMarketScore(marketId),
    prisma.marketDefenseNote.findMany({ where: { marketId } }),
  ]);

  const notesByCode = Object.fromEntries(
    defenseNotes.map((n) => [n.metricCode, {
      justification: n.justification ?? "",
      actionPlan: n.actionPlan ?? "",
      trend: n.trend,
    }])
  );

  const canEdit = session ? PERMISSIONS.markets.edit(session.user.role) : false;

  const marketMeta = {
    id: market.id,
    marketCode: market.marketCode,
    title: market.title,
    clientName: market.clientName,
    responsible: market.responsibleUser
      ? `${market.responsibleUser.firstName} ${market.responsibleUser.lastName}`
      : null,
    startDate: market.startDate ? format(market.startDate, "d MMM yyyy", { locale: fr }) : null,
    endDate: market.endDate ? format(market.endDate, "d MMM yyyy", { locale: fr }) : null,
    printDate: format(new Date(), "d MMMM yyyy", { locale: fr }),
  };

  return (
    <DefenseClient
      market={marketMeta}
      scoreResult={scoreResult}
      metricLabels={METRIC_LABELS}
      initialNotes={notesByCode}
      canEdit={canEdit}
    />
  );
}
