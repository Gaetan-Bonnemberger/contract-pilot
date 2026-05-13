import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { auth } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DONE: "bg-green-100 text-green-800",
  BLOCKED: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminé",
  BLOCKED: "Bloqué",
};

const COLUMNS = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

export default async function ActionsPage({
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

  const actions = await prisma.actionPlan.findMany({
    where: { marketId },
    include: {
      responsibleUser: true,
      alert: true,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const byStatus = (status: string) => actions.filter((a) => a.status === status);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {actions.filter((a) => a.status !== "DONE").length} action(s) en cours
        </p>
        <Button size="sm">+ Nouvelle action</Button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colActions = byStatus(col);
          return (
            <div key={col} className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[col]}`}
                >
                  {STATUS_LABELS[col]}
                </span>
                <span className="text-xs text-gray-400">{colActions.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {colActions.map((action) => (
                  <Card
                    key={action.id}
                    className={`shadow-none ${col === "BLOCKED" ? "border-red-200" : ""}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {action.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0"
                        >
                          P{action.priority}
                        </Badge>
                      </div>
                      {action.description && (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {action.description}
                        </p>
                      )}
                      {action.category && (
                        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {action.category}
                        </span>
                      )}
                      {action.riskCovered && (
                        <p className="text-xs text-orange-600">
                          Risque: {action.riskCovered}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {action.responsibleUser
                            ? `${action.responsibleUser.firstName} ${action.responsibleUser.lastName[0]}.`
                            : "—"}
                        </span>
                        {action.targetDate && (
                          <span>
                            {format(action.targetDate, "dd/MM/yy", { locale: fr })}
                          </span>
                        )}
                      </div>
                      {action.alert && (
                        <p className="text-xs text-red-500">
                          Alerte: {action.alert.alertType.replace(/_/g, " ")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {colActions.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-gray-300">Vide</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table complète */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold">Toutes les actions ({actions.length})</p>
        </div>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Priorité", "Titre", "Catégorie", "Risque couvert", "Responsable", "Échéance", "Résultat attendu", "Statut"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {actions.map((action) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-gray-700">P{action.priority}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px]">
                    {action.title}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {action.category ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-orange-600">
                    {action.riskCovered ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {action.responsibleUser
                      ? `${action.responsibleUser.firstName} ${action.responsibleUser.lastName[0]}.`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {action.targetDate
                      ? format(action.targetDate, "dd/MM/yyyy", { locale: fr })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">
                    {action.expectedResult ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[action.status]}`}
                    >
                      {STATUS_LABELS[action.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {actions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Aucune action définie.
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
