import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  MARKET_CREATED:      { label: "Marché créé",           color: "bg-blue-100 text-blue-800" },
  MARKET_UPDATED:      { label: "Marché modifié",         color: "bg-blue-100 text-blue-800" },
  MARKET_ARCHIVED:     { label: "Marché archivé",         color: "bg-gray-100 text-gray-700" },
  ALERT_CLOSED:        { label: "Alerte clôturée",        color: "bg-green-100 text-green-800" },
  ALERT_RECALCULATED:  { label: "Alertes recalculées",    color: "bg-yellow-100 text-yellow-800" },
  ANALYSIS_STARTED:    { label: "Analyse lancée",         color: "bg-purple-100 text-purple-800" },
  ANALYSIS_VALIDATED:  { label: "Analyse validée",        color: "bg-purple-100 text-purple-800" },
  DOCUMENT_UPLOADED:   { label: "Document uploadé",       color: "bg-orange-100 text-orange-800" },
  DOCUMENT_VERIFIED:   { label: "Document vérifié",       color: "bg-orange-100 text-orange-800" },
  SCORE_CALCULATED:    { label: "Score calculé",          color: "bg-teal-100 text-teal-800" },
  ACTION_CREATED:      { label: "Action créée",           color: "bg-indigo-100 text-indigo-800" },
  ACTION_UPDATED:      { label: "Action mise à jour",     color: "bg-indigo-100 text-indigo-800" },
  EVENT_CREATED:       { label: "Événement créé",         color: "bg-red-100 text-red-800" },
  AVENANT_CREATED:     { label: "Avenant créé",           color: "bg-cyan-100 text-cyan-800" },
  AVENANT_UPDATED:     { label: "Avenant mis à jour",     color: "bg-cyan-100 text-cyan-800" },
  AVENANT_DELETED:     { label: "Avenant supprimé",       color: "bg-gray-100 text-gray-600" },
  NC_CREATED:          { label: "NC créée",               color: "bg-rose-100 text-rose-800" },
  NC_UPDATED:          { label: "NC mise à jour",         color: "bg-rose-100 text-rose-800" },
  NC_CLOSED:           { label: "NC clôturée",            color: "bg-emerald-100 text-emerald-800" },
  USER_LOGIN:          { label: "Connexion",              color: "bg-gray-100 text-gray-600" },
};

export default async function AuditPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Seuls les admins et directeurs voient le journal global
  if (!["ADMIN", "DIRECTEUR"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, role: true } },
      market: { select: { marketCode: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Journal d'audit"
        subtitle={`${logs.length} entrée(s) — 200 dernières actions`}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Historique des actions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">
                Aucune action enregistrée pour l'instant.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-36">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-40">Utilisateur</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-44">Action</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-28">Marché</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-700" };
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {format(log.createdAt, "dd/MM/yy HH:mm", { locale: fr })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-xs">
                            {log.user.firstName} {log.user.lastName}
                          </div>
                          <div className="text-gray-400 text-xs">{log.user.role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                          {log.market?.marketCode ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">
                          {log.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
