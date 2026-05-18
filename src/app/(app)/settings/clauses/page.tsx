import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icons";

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT: "bg-orange-100 text-orange-800",
  MOYEN: "bg-yellow-100 text-yellow-700",
  FAIBLE: "bg-gray-100 text-gray-600",
};

export default async function ClauseReferencesPage() {
  const clauses = await prisma.clauseReference.findMany({
    orderBy: [{ family: "asc" }, { clauseCode: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Référentiel clauses"
        subtitle="Clauses types utilisables sur tous les marchés"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle clause
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Code", "Article", "Titre", "Famille", "Criticité", "Impact", "Formule pénalité"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clauses.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{c.clauseCode}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.articleRef ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.family}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[c.criticality]}`}>
                        {c.criticality}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.impactType ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.defaultPenaltyFormula ?? "—"}</td>
                  </tr>
                ))}
                {clauses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Aucune clause de référence.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
