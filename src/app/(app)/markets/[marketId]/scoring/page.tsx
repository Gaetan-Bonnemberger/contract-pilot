import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_WEIGHTS, METRIC_LABELS, loadWeights } from "@/lib/score";
import { ScoringClient } from "./scoring-client";

export default async function MarketScoringPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const session = await auth();
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true, title: true },
  });
  if (!market) notFound();

  const currentWeights = await loadWeights(marketId);
  const overrides = await prisma.marketScoreWeight.findMany({
    where: { marketId },
    select: { metricCode: true },
  });
  const isCustom = Object.fromEntries(overrides.map((o) => [o.metricCode, true]));
  const hasCustom = overrides.length > 0;

  const canEdit = session ? PERMISSIONS.markets.edit(session.user.role) : false;

  return (
    <ScoringClient
      marketId={marketId}
      currentWeights={currentWeights}
      defaultWeights={DEFAULT_WEIGHTS}
      metricLabels={METRIC_LABELS}
      isCustom={isCustom}
      hasCustom={hasCustom}
      canEdit={canEdit}
    />
  );
}
