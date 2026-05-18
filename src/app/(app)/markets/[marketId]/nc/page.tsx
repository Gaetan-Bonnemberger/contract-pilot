import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canWrite, PERMISSIONS } from "@/lib/permissions";
import { NcClient } from "./nc-client";

export default async function NcPage({
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

  const [ncs, projects] = await Promise.all([
    prisma.nonConformite.findMany({
      where: { marketId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        project: { select: { projectCode: true, siteName: true } },
      },
      orderBy: { detectedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { marketId },
      select: { id: true, projectCode: true, siteName: true },
      orderBy: { projectCode: "asc" },
    }),
  ]);

  const userCanWrite = session ? canWrite(session.user.role) : false;
  const userCanClose = session ? PERMISSIONS.markets.edit(session.user.role) : false;

  return (
    <NcClient
      marketId={market.id}
      ncs={ncs.map((n) => ({
        id: n.id,
        ncType: n.ncType,
        severity: n.severity,
        description: n.description,
        detectedAt: n.detectedAt.toISOString(),
        rootCause: n.rootCause,
        correctiveAction: n.correctiveAction,
        status: n.status,
        closedAt: n.closedAt?.toISOString() ?? null,
        scoreImpact: Number(n.scoreImpact),
        projectId: n.projectId,
        project: n.project,
        createdBy: n.createdBy,
        createdAt: n.createdAt.toISOString(),
      }))}
      projects={projects}
      canWrite={userCanWrite}
      canClose={userCanClose}
    />
  );
}
