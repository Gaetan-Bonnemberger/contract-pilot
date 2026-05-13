import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ScoringPage() {
  const scoreModels = await prisma.scoreModel.findMany({
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { isDefault: "desc" },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Modèles de scoring"
        subtitle="Pondérations pour le calcul du score santé des marchés"
      />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {scoreModels.map((model) => {
          const totalWeight = model.lines.reduce((s, l) => s + Number(l.weight), 0);
          return (
            <Card key={model.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {model.name}
                  {model.isDefault && (
                    <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">
                      Par défaut
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["#", "Métrique", "Pondération", "Règle verte", "Règle orange", "Règle rouge"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {model.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{line.sortOrder}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{line.label}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 bg-blue-400 rounded"
                              style={{ width: `${(Number(line.weight) / 20) * 80}px` }}
                            />
                            <span className="text-xs font-semibold text-gray-700">
                              {Number(line.weight)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-green-700">{line.greenRule ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-orange-600">{line.orangeRule ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-red-600">{line.redRule ?? "—"}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-700">
                        Total pondérations
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-bold ${totalWeight === 100 ? "text-green-600" : "text-red-600"}`}>
                          {totalWeight}%
                        </span>
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
        {scoreModels.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            Aucun modèle de scoring. Le seed doit être exécuté.
          </div>
        )}
      </main>
    </div>
  );
}
