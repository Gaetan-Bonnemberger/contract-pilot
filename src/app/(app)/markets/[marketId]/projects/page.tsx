import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, Plus } from "@/components/icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

const STATUS_LABELS: Record<string, string> = {
  A_PLANIFIER: "À planifier",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  RECEPTIONNE: "Réceptionné",
  CLOTURE: "Clôturé",
};

const STATUS_COLORS: Record<string, string> = {
  A_PLANIFIER: "bg-gray-100 text-gray-600",
  EN_COURS: "bg-blue-100 text-blue-800",
  TERMINE: "bg-purple-100 text-purple-800",
  RECEPTIONNE: "bg-green-100 text-green-800",
  CLOTURE: "bg-gray-200 text-gray-600",
};

function IconBool({ val }: { val: boolean }) {
  return val ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-400" />
  );
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const session = await auth();
  const role = session!.user.role;
  const canCreate = PERMISSIONS.projects.create(role);

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true },
  });
  if (!market) notFound();

  const projects = await prisma.project.findMany({
    where: { marketId },
    include: {
      alerts: { where: { status: { not: "CLOSED" } } },
      events: { where: { eventType: "PENALITE" } },
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Stats
  const urgentCount = projects.filter((p) => p.isUrgent).length;
  const urgentLateCount = projects.filter((p) => p.isUrgentLate).length;
  const missingTopoCount = projects.filter(
    (p) => p.topoRequired && !p.topoDelivered
  ).length;

  return (
    <div className="p-6 space-y-4">
      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total chantiers</p>
          <p className="text-xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Urgents</p>
          <p className="text-xl font-bold text-orange-600">{urgentCount}</p>
        </div>
        <div className={`border rounded-lg p-3 ${urgentLateCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500">Urgences en retard</p>
          <p className={`text-xl font-bold ${urgentLateCount > 0 ? "text-red-600" : "text-gray-900"}`}>
            {urgentLateCount}
          </p>
        </div>
        <div className={`border rounded-lg p-3 ${missingTopoCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500">Topo manquant</p>
          <p className={`text-xl font-bold ${missingTopoCount > 0 ? "text-red-600" : "text-gray-900"}`}>
            {missingTopoCount}
          </p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">
            Chantiers ({projects.length})
          </p>
          {canCreate && (
            <Button asChild size="sm">
              <Link href={`/markets/${marketId}/projects/new`}>
                <Plus className="h-4 w-4 mr-1" />
                Nouveau chantier
              </Link>
            </Button>
          )}
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Code",
                    "Commande",
                    "Site",
                    "Planifié",
                    "Réalisé",
                    "Urg",
                    "Retard",
                    "AAT",
                    "PAT",
                    "Topo",
                    "Touret",
                    "Montant",
                    "Pénalités",
                    "Alertes",
                    "Statut",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.map((p) => {
                  const penalties = p.events.reduce(
                    (s, e) => s + Number(e.amountHt),
                    0
                  );
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.isUrgentLate ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700">
                        {p.projectCode}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {p.orderNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium text-xs max-w-[120px] truncate">
                        {p.siteName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {p.plannedDate
                          ? format(p.plannedDate, "dd/MM/yy", { locale: fr })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {p.performedDate
                          ? format(p.performedDate, "dd/MM/yy", { locale: fr })
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {p.isUrgent ? (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.isUrgent && <IconBool val={!p.isUrgentLate} />}
                        {!p.isUrgent && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <IconBool val={p.aatSigned} />
                      </td>
                      <td className="px-3 py-2">
                        <IconBool val={p.patReceived} />
                      </td>
                      <td className="px-3 py-2">
                        {p.topoRequired ? (
                          <IconBool val={p.topoDelivered} />
                        ) : (
                          <span className="text-xs text-gray-300">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.drumInvolved ? (
                          <IconBool val={!!p.drumRecoveryRequestedAt} />
                        ) : (
                          <span className="text-xs text-gray-300">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {Number(p.performedAmountHt).toLocaleString("fr-FR")} €
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {penalties > 0 ? (
                          <span className="text-red-600 font-medium">
                            {penalties.toLocaleString("fr-FR")} €
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.alerts.length > 0 ? (
                          <span className="text-red-600 font-medium">
                            {p.alerts.length}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Aucun chantier enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
