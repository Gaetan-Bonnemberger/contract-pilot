import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2 } from "lucide-react";

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT: "bg-orange-100 text-orange-800",
  MOYEN: "bg-yellow-100 text-yellow-700",
  FAIBLE: "bg-gray-100 text-gray-600",
};

export default async function DocumentReferencesPage() {
  const docs = await prisma.documentTypeReference.findMany({
    orderBy: [{ criticality: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Types de documents"
        subtitle="Documents requis par défaut sur vos chantiers"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau type
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Code", "Nom", "Obligatoire par défaut", "Déclencheur", "Délai (j)", "Criticité", "Responsable"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{d.docTypeCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-center">
                      {d.isMandatoryDefault ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.triggerCondition ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-center">{d.defaultDueDays ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[d.criticality]}`}>
                        {d.criticality}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.ownerRole ?? "—"}</td>
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
