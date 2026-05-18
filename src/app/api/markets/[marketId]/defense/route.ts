import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import type { DefenseTrend } from "@prisma/client";

// ── GET /api/markets/:id/defense ───────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const notes = await prisma.marketDefenseNote.findMany({
    where: { marketId },
  });

  // Indexer par metricCode pour faciliter l'usage côté client
  const byCode = Object.fromEntries(notes.map((n) => [n.metricCode, n]));
  return NextResponse.json(byCode);
}

// ── PUT /api/markets/:id/defense ───────────────────────────────────────────
// Body : { notes: Record<string, { justification, actionPlan, trend }> }
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
  const { notes } = await req.json() as {
    notes: Record<string, { justification: string; actionPlan: string; trend: DefenseTrend }>;
  };

  await Promise.all(
    Object.entries(notes).map(([metricCode, data]) =>
      prisma.marketDefenseNote.upsert({
        where: { marketId_metricCode: { marketId, metricCode } },
        update: {
          justification: data.justification || null,
          actionPlan: data.actionPlan || null,
          trend: data.trend,
          updatedById: session.user.id,
        },
        create: {
          marketId,
          metricCode,
          justification: data.justification || null,
          actionPlan: data.actionPlan || null,
          trend: data.trend,
          updatedById: session.user.id,
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
