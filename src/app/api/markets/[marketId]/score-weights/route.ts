import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_WEIGHTS } from "@/lib/score";

// ── GET /api/markets/:id/score-weights ─────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const overrides = await prisma.marketScoreWeight.findMany({
    where: { marketId },
  });

  // Fusionner défauts + surcharges
  const weights: Record<string, number> = { ...DEFAULT_WEIGHTS };
  const isCustom: Record<string, boolean> = {};
  for (const row of overrides) {
    weights[row.metricCode] = Number(row.weight);
    isCustom[row.metricCode] = true;
  }

  return NextResponse.json({ weights, isCustom, defaults: DEFAULT_WEIGHTS });
}

// ── PUT /api/markets/:id/score-weights ─────────────────────────────────────
// Body : { weights: Record<string, number> }  — doit sommer à 100
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;
  const { weights } = await req.json() as { weights: Record<string, number> };

  // Validation : somme = 100 (tolérance ±0.5 pour les arrondis)
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(total - 100) > 0.5) {
    return NextResponse.json(
      { error: `La somme des poids doit être égale à 100 (actuellement ${total.toFixed(1)})` },
      { status: 400 }
    );
  }

  // Validation : toutes les métriques connues
  const unknownKeys = Object.keys(weights).filter((k) => !(k in DEFAULT_WEIGHTS));
  if (unknownKeys.length > 0) {
    return NextResponse.json({ error: `Métriques inconnues : ${unknownKeys.join(", ")}` }, { status: 400 });
  }

  // Upsert chaque poids
  await Promise.all(
    Object.entries(weights).map(([metricCode, weight]) =>
      prisma.marketScoreWeight.upsert({
        where: { marketId_metricCode: { marketId, metricCode } },
        update: { weight },
        create: { marketId, metricCode, weight },
      })
    )
  );

  return NextResponse.json({ ok: true, total });
}

// ── DELETE /api/markets/:id/score-weights ──────────────────────────────────
// Réinitialise aux poids par défaut
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;

  await prisma.marketScoreWeight.deleteMany({ where: { marketId } });

  return NextResponse.json({ ok: true });
}
