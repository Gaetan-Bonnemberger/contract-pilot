import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function MarketHistoryPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const session = await auth();
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, marketCode: true, title: true },
  });

  if (!market) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { marketId },
    include: {
      user: { select: { firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Grouper par date
  const grouped: Record<string, typeof logs> = {};
  for (const log of logs) {
    const day = format(log.createdAt, "yyyy-MM-dd");
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Historique des actions</h2>
          <p className="text-xs text-gray-500">{logs.length} entrée(s) enregistrée(s)</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Aucune action enregistrée sur ce marché pour l'instant.
            <br />
            Les prochaines modifications apparaîtront ici automatiquement.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, entries]) => (
            <div key={day}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {format(new Date(day), "EEEE d MMMM yyyy", { locale: fr })}
              </div>
              <div className="relative border-l-2 border-gray-100 ml-2 space-y-4">
                {entries.map((log) => {
                  const meta = ACTION_LABELS[log.action] ?? {
                    label: log.action,
                    color: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <div key={log.id} className="relative pl-6">
                      {/* Point sur la timeline */}
                      <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-gray-300 border-2 border-white" />
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{log.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {log.user.firstName} {log.user.lastName}{" "}
                            <span className="text-gray-300">·</span>{" "}
                            {format(log.createdAt, "HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
