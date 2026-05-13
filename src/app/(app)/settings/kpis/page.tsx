import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function KpiReferencesPage() {
  const kpis = await prisma.kpiReference.findMany({
    orderBy: [{ category: "asc" }, { kpiCode: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Référentiel KPI"
        subtitle="KPI types applicables à vos marchés"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau KPI
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Code", "Nom", "Catégorie", "Type", "Fréquence", "Unité", "Seuil vert", "Seuil orange", "Seuil rouge"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {kpis.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{k.kpiCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{k.category}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{k.kpiType}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{k.frequency ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{k.unit ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-green-700">
                      {k.defaultGreenThreshold ? `≥${Number(k.defaultGreenThreshold)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-orange-600">
                      {k.defaultOrangeThreshold ? `≥${Number(k.defaultOrangeThreshold)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600">
                      {k.defaultRedThreshold ? `≥${Number(k.defaultRedThreshold)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
