/**
 * /api/markets/:marketId/scores
 * GET  — Historique des snapshots de score (30 derniers)
 * POST — Force un nouveau snapshot (ignore le rate-limit quotidien)
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMarketScore, forceScoreSnapshot } from "@/lib/score";

// ── GET — Historique des scores ───────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });

  const scores = await prisma.marketScore.findMany({
    where: { marketId },
    orderBy: { calculatedAt: "asc" },
    take: 90, // 3 mois de snapshots quotidiens
    select: {
      id: true,
      scoreValue: true,
      scoreLabel: true,
      calculatedAt: true,
      details: true,
    },
  });

  // Sérialiser les valeurs Decimal
  const serialized = scores.map((s) => ({
    ...s,
    scoreValue: Number(s.scoreValue),
    calculatedAt: s.calculatedAt.toISOString(),
  }));

  return NextResponse.json(serialized);
}

// ── POST — Forcer un snapshot manuel ─────────────────────────────────────────
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });

  try {
    const result = await calculateMarketScore(marketId);
    const snapshot = await forceScoreSnapshot(marketId, result);

    return NextResponse.json({
      score: result,
      snapshot: {
        ...snapshot,
        scoreValue: Number(snapshot.scoreValue),
        calculatedAt: snapshot.calculatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Erreur lors du calcul du score" }, { status: 500 });
  }
}
