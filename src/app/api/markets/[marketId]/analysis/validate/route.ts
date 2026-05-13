import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import type { AnalysisResult } from "@/lib/llm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.analysis.validate(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;

  const summary = await prisma.marketSummary.findUnique({
    where: { marketId },
    include: { analysisRun: true },
  });

  if (!summary) {
    return NextResponse.json({ error: "Aucune analyse à valider" }, { status: 404 });
  }

  // Marquer comme validé
  await prisma.marketSummary.update({
    where: { marketId },
    data: {
      validatedById: session.user.id,
      validatedAt: new Date(),
    },
  });

  // Créer les entités depuis le llmRawResponse si pas encore fait
  const run = summary.analysisRun;
  if (run?.llmRawResponse) {
    const result = run.llmRawResponse as unknown as AnalysisResult;

    // Créer clauses si absentes
    const existingClauses = await prisma.marketClause.count({ where: { marketId } });
    if (existingClauses === 0 && result.extractedClauses) {
      await prisma.marketClause.createMany({
        data: result.extractedClauses.map((c) => ({
          marketId,
          articleRef: c.articleRef,
          title: c.title,
          description: c.description,
          criticality: c.criticality as "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE",
          isContractual: true,
          requiresFollowUp: c.requiresFollowUp,
        })),
      });
    }

    // Créer KPIs si absents
    const existingKpis = await prisma.marketKpi.count({ where: { marketId } });
    if (existingKpis === 0 && result.extractedKpis) {
      await prisma.marketKpi.createMany({
        data: result.extractedKpis.map((k) => ({
          marketId,
          kpiCode: k.kpiCode,
          name: k.name,
          category: k.category,
          kpiType: k.kpiType,
          unit: k.unit,
          frequency: k.frequency,
          greenThreshold: k.greenThreshold ?? undefined,
          orangeThreshold: k.orangeThreshold ?? undefined,
          redThreshold: k.redThreshold ?? undefined,
        })),
      });
    }

    // Créer obligations si absentes
    const existingObs = await prisma.marketObligation.count({ where: { marketId } });
    if (existingObs === 0 && result.extractedObligations) {
      await prisma.marketObligation.createMany({
        data: result.extractedObligations.map((o) => ({
          marketId,
          title: o.title,
          description: o.description,
          category: o.category,
          criticality: o.criticality as "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE",
          frequency: o.frequency,
          triggerCondition: o.triggerCondition,
          expectedEvidence: o.expectedEvidence,
          dueRule: o.dueRule,
        })),
      });
    }
  }

  return NextResponse.json({ success: true });
}
