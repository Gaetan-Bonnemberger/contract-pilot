import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { AnalysisPanel } from "@/components/analysis/analysis-panel";
import { serialize } from "@/lib/serialize";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const session = await auth();
  const role = session!.user.role;
  const canRun = PERMISSIONS.analysis.run(role);
  const canValidate = PERMISSIONS.analysis.validate(role);

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      summary: {
        include: {
          analysisRun: { select: { status: true, completedAt: true, llmRawResponse: true } },
          validatedBy: { select: { firstName: true, lastName: true } },
        },
      },
      files: { where: { isActive: true, documentType: "CONTRAT" } },
      clauses: true,
      kpis: true,
      obligations: true,
    },
  });

  if (!market) notFound();

  return (
    <div className="p-6">
      <AnalysisPanel
        market={serialize(market)}
        canRun={canRun}
        canValidate={canValidate}
      />
    </div>
  );
}
