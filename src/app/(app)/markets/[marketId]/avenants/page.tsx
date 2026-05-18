import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { AvenantsClient } from "./avenants-client";

export default async function AvenantsPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const session = await auth();
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true, title: true, firmAmountHt: true },
  });
  if (!market) notFound();

  const avenants = await prisma.avenant.findMany({
    where: { marketId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { avenantNumber: "asc" },
  });

  const canEdit = session ? PERMISSIONS.markets.edit(session.user.role) : false;

  return (
    <AvenantsClient
      market={{
        id: market.id,
        marketCode: market.marketCode,
        title: market.title,
        firmAmountHt: market.firmAmountHt ? Number(market.firmAmountHt) : null,
      }}
      initialAvenants={avenants.map((a) => ({
        id: a.id,
        avenantNumber: a.avenantNumber,
        nature: a.nature,
        signedAt: a.signedAt?.toISOString() ?? null,
        deltaAmountHt: a.deltaAmountHt ? Number(a.deltaAmountHt) : null,
        deltaDelayDays: a.deltaDelayDays,
        status: a.status,
        notes: a.notes,
        createdBy: a.createdBy,
        createdAt: a.createdAt.toISOString(),
      }))}
      canEdit={canEdit}
    />
  );
}
