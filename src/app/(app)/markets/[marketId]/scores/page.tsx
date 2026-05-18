import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ScoresClient } from "./scores-client";

export default async function MarketScoresPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  await auth(); // vérifie la session (middleware protège déjà)
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true, title: true },
  });
  if (!market) notFound();

  // Récupérer les 90 derniers snapshots
  const rawScores = await prisma.marketScore.findMany({
    where: { marketId },
    orderBy: { calculatedAt: "asc" },
    take: 90,
    select: {
      id: true,
      scoreValue: true,
      scoreLabel: true,
      calculatedAt: true,
      details: true,
    },
  });

  const scores = rawScores.map((s) => ({
    id: s.id,
    scoreValue: Number(s.scoreValue),
    scoreLabel: s.scoreLabel,
    calculatedAt: s.calculatedAt.toISOString(),
    details: s.details,
  }));

  return (
    <ScoresClient
      marketId={marketId}
      initialScores={scores}
    />
  );
}
