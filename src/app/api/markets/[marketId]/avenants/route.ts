import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

// ── GET /api/markets/:id/avenants ──────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;

  const avenants = await prisma.avenant.findMany({
    where: { marketId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { avenantNumber: "asc" },
  });

  return NextResponse.json(avenants);
}

// ── POST /api/markets/:id/avenants ─────────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.edit(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;
  const body = await req.json();

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true, firmAmountHt: true },
  });
  if (!market) return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });

  // Numéro d'avenant : prochain dans la séquence
  const lastAvenant = await prisma.avenant.findFirst({
    where: { marketId },
    orderBy: { avenantNumber: "desc" },
    select: { avenantNumber: true },
  });
  const avenantNumber = (lastAvenant?.avenantNumber ?? 0) + 1;

  const avenant = await prisma.avenant.create({
    data: {
      marketId,
      avenantNumber,
      nature: body.nature,
      signedAt: body.signedAt ? new Date(body.signedAt) : null,
      deltaAmountHt: body.deltaAmountHt ?? null,
      deltaDelayDays: body.deltaDelayDays ?? null,
      status: body.status ?? "EN_COURS",
      notes: body.notes ?? null,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  await audit({
    userId: session.user.id,
    action: "AVENANT_CREATED",
    entityType: "Avenant",
    entityId: avenant.id,
    marketId,
    label: `Avenant n°${avenantNumber} créé — ${body.nature}`,
    details: { avenantNumber, deltaAmountHt: body.deltaAmountHt, deltaDelayDays: body.deltaDelayDays },
  });

  return NextResponse.json(avenant, { status: 201 });
}
