import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calculateMarketScore, saveScoreSnapshot, scoreBgColor, scoreColor } from "@/lib/score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Euro,
  Calendar,
  User,
  FileText,
  ArrowRight,
} from "@/components/icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  MAJEUR: "bg-orange-100 text-orange-800",
  MINEUR: "bg-yellow-100 text-yellow-800",
};

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT: "bg-orange-100 text-orange-800",
  MOYEN: "bg-yellow-100 text-yellow-700",
  FAIBLE: "bg-gray-100 text-gray-600",
};

export default async function MarketOverviewPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      responsibleUser: true,
      summary: true,
      clauses: { where: { criticality: "CRITIQUE" }, take: 5 },
      kpis: { take: 6 },
      alerts: {
        where: { status: { not: "CLOSED" } },
        include: { project: true },
        orderBy: { severity: "desc" },
        take: 5,
      },
      events: { orderBy: { eventDate: "desc" }, take: 5 },
      _count: {
        select: { projects: true, obligations: true, actions: true },
      },
    },
  });

  if (!market) notFound();

  // Calculer le score et enregistrer un snapshot quotidien (fire-and-forget)
  let score = null;
  try {
    score = await calculateMarketScore(marketId);
    void saveScoreSnapshot(marketId, score);
  } catch {
    // Score non calculable (données insuffisantes)
  }

  const totalPenalties = market.events
    .filter((e) => e.eventType === "PENALITE")
    .reduce((sum, e) => sum + Number(e.amountHt), 0);

  const totalBonus = market.events
    .filter((e) => e.eventType === "BONUS")
    .reduce((sum, e) => sum + Number(e.amountHt), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Infos générales */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="col-span-3">
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" /> Responsable
                  </p>
                  <p className="font-medium">
                    {market.responsibleUser
                      ? `${market.responsibleUser.firstName} ${market.responsibleUser.lastName}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium">{market.marketType}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Début
                  </p>
                  <p className="font-medium">
                    {market.startDate
                      ? format(market.startDate, "dd/MM/yyyy", { locale: fr })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fin</p>
                  <p className="font-medium">
                    {market.endDate
                      ? format(market.endDate, "dd/MM/yyyy", { locale: fr })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Euro className="h-3 w-3" /> Montant ferme HT
                  </p>
                  <p className="font-medium">
                    {market.firmAmountHt
                      ? `${Number(market.firmAmountHt).toLocaleString("fr-FR")} €`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Options HT</p>
                  <p className="font-medium">
                    {market.optionAmountHt
                      ? `${Number(market.optionAmountHt).toLocaleString("fr-FR")} €`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score santé */}
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500 mb-2">Score santé</p>
            {score ? (
              <>
                <div
                  className={`text-4xl font-bold ${scoreColor(score.total)}`}
                >
                  {score.total}
                </div>
                <div className="text-sm text-gray-500 mb-3">/100</div>
                <Badge
                  className={`text-xs ${scoreBgColor(score.total)} border-0`}
                >
                  {score.label}
                </Badge>
                <div className="mt-3 space-y-1">
                  {score.details.slice(0, 4).map((d) => (
                    <div key={d.metricCode} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{d.label}</span>
                      <span
                        className={
                          d.color === "green"
                            ? "text-green-600 font-medium"
                            : d.color === "orange"
                            ? "text-orange-500 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {Math.round(d.normalizedScore)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Non calculé</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Chantiers", value: market._count.projects, icon: FileText, href: "projects" },
          { label: "Alertes ouvertes", value: market.alerts.length, icon: AlertTriangle, href: "alerts", danger: true },
          { label: "Obligations", value: market._count.obligations, icon: FileText, href: "obligations" },
          { label: "Pénalités", value: `${totalPenalties.toLocaleString("fr-FR")} €`, icon: TrendingDown, href: "events", danger: totalPenalties > 0 },
          { label: "Bonus", value: `${totalBonus.toLocaleString("fr-FR")} €`, icon: Euro, href: "events" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <Icon className={`h-4 w-4 ${stat.danger ? "text-red-300" : "text-gray-300"}`} />
                </div>
                <p className={`text-xl font-bold ${stat.danger ? "text-red-600" : "text-gray-900"}`}>
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Résumé exécutif */}
        <div className="col-span-2 space-y-4">
          {market.summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Résumé exécutif</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {market.summary.executiveSummary}
                </p>
                {market.summary.majorRisks && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs font-semibold text-orange-800 mb-1">Risques majeurs</p>
                    <p className="text-xs text-orange-700">{market.summary.majorRisks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Clauses critiques */}
          {market.clauses.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Clauses critiques</CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                  <Link href={`/markets/${marketId}/clauses`}>
                    Toutes <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {market.clauses.map((clause) => (
                  <div
                    key={clause.id}
                    className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{clause.title}</p>
                      {clause.articleRef && (
                        <p className="text-xs text-gray-400">Art. {clause.articleRef}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${CRITICALITY_COLORS[clause.criticality]}`}
                    >
                      {clause.criticality}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Alertes + KPIs */}
        <div className="space-y-4">
          {/* Alertes */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Alertes
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                <Link href={`/markets/${marketId}/alerts`}>
                  Voir <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {market.alerts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Aucune alerte ouverte</p>
              )}
              {market.alerts.map((alert) => (
                <div key={alert.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900">
                      {alert.alertType.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[alert.severity]}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  {alert.project && (
                    <p className="text-xs text-gray-500">{alert.project.projectCode} — {alert.project.siteName}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">KPI</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                <Link href={`/markets/${marketId}/kpis`}>
                  Voir <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {market.kpis.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Aucun KPI défini</p>
              )}
              {market.kpis.map((kpi) => {
                const val = kpi.currentValue ? Number(kpi.currentValue) : null;
                const green = kpi.greenThreshold ? Number(kpi.greenThreshold) : null;
                const red = kpi.redThreshold ? Number(kpi.redThreshold) : null;
                let color = "text-gray-500";
                if (val !== null && green !== null && red !== null) {
                  color = val >= green ? "text-green-600" : val >= red ? "text-orange-500" : "text-red-600";
                }

                return (
                  <div key={kpi.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 truncate max-w-[130px]">{kpi.name}</span>
                    <span className={`text-xs font-semibold ${color}`}>
                      {val !== null ? `${val} ${kpi.unit ?? ""}` : "—"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
