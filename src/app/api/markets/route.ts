import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createMarketSchema = z.object({
  marketCode: z.string().min(1),
  title: z.string().min(1),
  clientName: z.string().min(1),
  lotName: z.string().optional(),
  marketType: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  firmAmountHt: z.number().optional(),
  optionAmountHt: z.number().optional(),
  renewalCount: z.number().int().default(0),
  qualityThreshold: z.number().optional(),
  safetyThreshold: z.number().optional(),
  responsibleUserId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const markets = await prisma.market.findMany({
    include: {
      responsibleUser: { select: { firstName: true, lastName: true } },
      _count: { select: { projects: true, alerts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(markets);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.markets.create(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createMarketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  const market = await prisma.market.create({
    data: {
      marketCode: data.marketCode,
      title: data.title,
      clientName: data.clientName,
      lotName: data.lotName,
      marketType: data.marketType,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      firmAmountHt: data.firmAmountHt,
      optionAmountHt: data.optionAmountHt,
      renewalCount: data.renewalCount,
      qualityThreshold: data.qualityThreshold,
      safetyThreshold: data.safetyThreshold,
      responsibleUserId: data.responsibleUserId,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(market, { status: 201 });
}
