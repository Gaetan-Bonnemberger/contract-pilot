import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2 } from "@/components/icons";

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT: "bg-orange-100 text-orange-800",
  MOYEN: "bg-yellow-100 text-yellow-700",
  FAIBLE: "bg-gray-100 text-gray-600",
};

export default async function ClausesPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) notFound();

  const clauses = await prisma.marketClause.findMany({
    where: { marketId },
    include: {
      clauseReference: true,
      obligations: true,
    },
    orderBy: [{ criticality: "asc" }, { articleRef: "asc" }],
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{clauses.length} clause(s)</p>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une clause
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Art.", "Titre", "Criticité", "Contractuelle", "Suivi requis", "Obligations liées"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clauses.map((clause) => (
                <tr key={clause.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 font-medium">
                    {clause.articleRef ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{clause.title}</p>
                    {clause.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[300px]">
                        {clause.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[clause.criticality]}`}
                    >
                      {clause.criticality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {clause.isContractual ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {clause.requiresFollowUp ? (
                      <CheckCircle2 className="h-4 w-4 text-orange-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {clause.obligations.length > 0
                      ? `${clause.obligations.length} obligation(s)`
                      : "—"}
                  </td>
                </tr>
              ))}
              {clauses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Aucune clause. Lancez une analyse IA ou ajoutez-en manuellement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
