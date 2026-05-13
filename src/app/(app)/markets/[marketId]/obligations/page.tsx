import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT: "bg-orange-100 text-orange-800",
  MOYEN: "bg-yellow-100 text-yellow-700",
  FAIBLE: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  A_FAIRE: "bg-gray-100 text-gray-600",
  EN_COURS: "bg-blue-100 text-blue-800",
  CONFORME: "bg-green-100 text-green-800",
  NON_CONFORME: "bg-red-100 text-red-800",
};

export default async function ObligationsPage({
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

  const obligations = await prisma.marketObligation.findMany({
    where: { marketId },
    orderBy: [{ criticality: "asc" }, { category: "asc" }],
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{obligations.length} obligation(s)</p>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une obligation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Obligation", "Catégorie", "Criticité", "Fréquence", "Déclencheur", "Preuve attendue", "Règle d'échéance", "Statut"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {obligations.map((ob) => (
                <tr key={ob.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-medium text-gray-900">{ob.title}</p>
                    {ob.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{ob.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ob.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[ob.criticality]}`}>
                      {ob.criticality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ob.frequency ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ob.triggerCondition ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ob.expectedEvidence ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ob.dueRule ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ob.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ob.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {obligations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Aucune obligation définie.
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
