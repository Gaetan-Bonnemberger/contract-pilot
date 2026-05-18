import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icons";

function KpiStatusBar({ value, green, orange, red }: {
  value: number | null;
  green: number | null;
  orange: number | null;
  red: number | null;
}) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>;

  let color = "bg-gray-300";
  let textColor = "text-gray-600";
  let label = "—";

  if (green !== null && value >= green) {
    color = "bg-green-500";
    textColor = "text-green-700";
    label = "Vert";
  } else if (orange !== null && value >= orange) {
    color = "bg-orange-400";
    textColor = "text-orange-700";
    label = "Orange";
  } else if (red !== null && value >= red) {
    color = "bg-red-500";
    textColor = "text-red-700";
    label = "Rouge";
  } else {
    color = "bg-red-700";
    textColor = "text-red-800";
    label = "Critique";
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
      <span className={`text-sm font-semibold ${textColor}`}>
        {value} {label !== "—" && `(${label})`}
      </span>
    </div>
  );
}

export default async function KpisPage({
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

  const kpis = await prisma.marketKpi.findMany({
    where: { marketId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const categories = [...new Set(kpis.map((k) => k.category))];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{kpis.length} KPI(s) défini(s)</p>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter un KPI
        </Button>
      </div>

      {categories.map((cat) => {
        const catKpis = kpis.filter((k) => k.category === cat);
        return (
          <Card key={cat}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cat}</p>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Code", "KPI", "Type", "Fréquence", "Valeur actuelle", "Cible", "Seuil vert", "Seuil orange", "Seuil rouge", "Unité"].map(
                      (h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {catKpis.map((kpi) => (
                    <tr key={kpi.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{kpi.kpiCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{kpi.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{kpi.kpiType}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{kpi.frequency ?? "—"}</td>
                      <td className="px-4 py-3">
                        <KpiStatusBar
                          value={kpi.currentValue ? Number(kpi.currentValue) : null}
                          green={kpi.greenThreshold ? Number(kpi.greenThreshold) : null}
                          orange={kpi.orangeThreshold ? Number(kpi.orangeThreshold) : null}
                          red={kpi.redThreshold ? Number(kpi.redThreshold) : null}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {kpi.targetValue ? `${Number(kpi.targetValue)} ${kpi.unit ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-green-700">
                        {kpi.greenThreshold ? `≥${Number(kpi.greenThreshold)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-orange-600">
                        {kpi.orangeThreshold ? `≥${Number(kpi.orangeThreshold)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600">
                        {kpi.redThreshold ? `≥${Number(kpi.redThreshold)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{kpi.unit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}

      {kpis.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>Aucun KPI défini.</p>
          <p className="text-sm mt-1">Lancez une analyse IA ou ajoutez les KPI manuellement.</p>
        </div>
      )}
    </div>
  );
}
