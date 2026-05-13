import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecalculateAlertsButton } from "@/components/alerts/recalculate-button";
import { CloseAlertButton } from "@/components/alerts/close-alert-button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800 border border-red-200",
  MAJEUR: "bg-orange-100 text-orange-800 border border-orange-200",
  MINEUR: "bg-yellow-100 text-yellow-700 border border-yellow-200",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  IN_PROGRESS: "En cours",
  CLOSED: "Clôturée",
};

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const session = await auth();
  const role = session!.user.role;
  const canRecalculate = PERMISSIONS.alerts.recalculate(role);
  const canClose = PERMISSIONS.alerts.close(role);

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) notFound();

  const alerts = await prisma.alert.findMany({
    where: { marketId },
    include: {
      project: true,
      responsibleUser: true,
      actions: true,
    },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { detectedAt: "desc" }],
  });

  const openAlerts = alerts.filter((a) => a.status !== "CLOSED");
  const closedAlerts = alerts.filter((a) => a.status === "CLOSED");

  return (
    <div className="p-6 space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {openAlerts.length} alerte(s) ouverte(s) — {closedAlerts.length} clôturée(s)
          </p>
        </div>
        <div className="flex gap-2">
          {canRecalculate && (
            <RecalculateAlertsButton marketId={marketId} />
          )}
        </div>
      </div>

      {/* Alertes ouvertes */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Alertes ouvertes</p>
        </div>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Type", "Projet", "Gravité", "Cause", "Responsable", "Détectée", "Actions attendues", "Plans d'action", ""].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {openAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-900">
                      {alert.alertType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {alert.project ? (
                      <div>
                        <p className="font-medium">{alert.project.projectCode}</p>
                        <p className="text-gray-400">{alert.project.siteName}</p>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                    {alert.cause}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {alert.responsibleUser
                      ? `${alert.responsibleUser.firstName} ${alert.responsibleUser.lastName[0]}.`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {format(alert.detectedAt, "dd/MM/yyyy", { locale: fr })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                    {alert.expectedAction}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {alert.actions.length > 0 ? (
                      <span className="text-blue-600">{alert.actions.length} action(s)</span>
                    ) : (
                      <span className="text-gray-400">Aucune</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href={`/markets/${marketId}/actions?alertId=${alert.id}`}>
                          <Plus className="h-3 w-3 mr-1" />
                          Action
                        </Link>
                      </Button>
                      {canClose && (
                        <CloseAlertButton alertId={alert.id} marketId={marketId} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {openAlerts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Aucune alerte ouverte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Alertes clôturées */}
      {closedAlerts.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-500">Alertes clôturées ({closedAlerts.length})</p>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Type", "Projet", "Gravité", "Cause", "Clôturée le"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {closedAlerts.slice(0, 10).map((alert) => (
                  <tr key={alert.id} className="opacity-60">
                    <td className="px-4 py-2 text-xs text-gray-600">{alert.alertType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{alert.project?.projectCode ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate">{alert.cause}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {alert.closedAt ? format(alert.closedAt, "dd/MM/yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
