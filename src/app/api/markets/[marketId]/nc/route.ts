import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { canWrite } from "@/lib/permissions";
import { applyNcImpactToKpi, NC_SCORE_IMPACT } from "@/lib/nc";
import type { NcSeverity, NcType } from "@prisma/client";

// ── GET /api/markets/:id/nc ────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const ncs = await prisma.nonConformite.findMany({
    where: { marketId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      project: { select: { projectCode: true, siteName: true } },
    },
    orderBy: { detectedAt: "desc" },
  });

  return NextResponse.json(ncs);
}

// ── POST /api/markets/:id/nc ───────────────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!canWrite(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;
  const body = await req.json();

  if (!body.description?.trim() || !body.ncType || !body.severity || !body.detectedAt) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const impact = NC_SCORE_IMPACT[body.severity as NcSeverity] ?? 0;

  const nc = await prisma.nonConformite.create({
    data: {
      marketId,
      projectId: body.projectId ?? null,
      ncType: body.ncType as NcType,
      severity: body.severity as NcSeverity,
      description: body.description.trim(),
      detectedAt: new Date(body.detectedAt),
      rootCause: body.rootCause?.trim() || null,
      correctiveAction: body.correctiveAction?.trim() || null,
      status: "OUVERTE",
      scoreImpact: impact,
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      project: { select: { projectCode: true, siteName: true } },
    },
  });

  // Appliquer l'impact négatif sur le KPI
  await applyNcImpactToKpi(marketId, body.ncType as NcType, -impact);

  await audit({
    userId: session.user.id,
    action: "NC_CREATED",
    entityType: "NonConformite",
    entityId: nc.id,
    marketId,
    label: `NC ${body.ncType} ${body.severity} créée — ${body.description.slice(0, 60)}`,
    details: { ncType: body.ncType, severity: body.severity, scoreImpact: -impact },
  });

  return NextResponse.json(nc, { status: 201 });
}
