import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Building2,
  FileText,
  Euro,
  ArrowRight,
} from "@/components/icons";
import { scoreBgColor } from "@/lib/score";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const MARKET_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  ARCHIVED: "Archivé",
  CLOSED: "Clôturé",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  MAJEUR: "bg-orange-100 text-orange-800",
  MINEUR: "bg-yellow-100 text-yellow-800",
};

export default async function DashboardPage() {
  const session = await auth();

  // Stats globales
  const [
    activeMarkets,
    totalAlerts,
    criticalAlerts,
    recentPenalties,
    markets,
    topAlerts,
  ] = await Promise.all([
    prisma.market.count({ where: { status: "ACTIVE" } }),
    prisma.alert.count({ where: { status: { not: "CLOSED" } } }),
    prisma.alert.count({ where: { status: { not: "CLOSED" }, severity: "CRITIQUE" } }),
    prisma.marketEvent.aggregate({
      where: { eventType: "PENALITE" },
      _sum: { amountHt: true },
    }),
    prisma.market.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: {
        responsibleUser: true,
        alerts: { where: { status: { not: "CLOSED" } } },
        events: true,
        scores: { orderBy: { calculatedAt: "desc" }, take: 1 },
        _count: { select: { projects: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.alert.findMany({
      where: { status: { not: "CLOSED" }, severity: "CRITIQUE" },
      include: { market: true, project: true },
      orderBy: { detectedAt: "desc" },
      take: 5,
    }),
  ]);

  const totalPenalties = Number(recentPenalties._sum.amountHt ?? 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Dashboard"
        subtitle="Vue globale de tous les marchés"
        actions={
          <Button asChild size="sm">
            <Link href="/markets/new">+ Nouveau marché</Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs globaux */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Marchés actifs</p>
                  <p className="text-2xl font-bold text-gray-900">{activeMarkets}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Alertes ouvertes</p>
                  <p className="text-2xl font-bold text-orange-600">{totalAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Alertes critiques</p>
                  <p className="text-2xl font-bold text-red-600">{criticalAlerts}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pénalités cumulées</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalPenalties.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-gray-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Liste marchés */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Marchés</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Code</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Client</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Titre</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Score</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Alertes</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Statut</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market) => {
                      const lastScore = market.scores[0];
                      const scoreVal = lastScore ? Number(lastScore.scoreValue) : null;
                      const alertCount = market.alerts.length;

                      return (
                        <tr
                          key={market.id}
                          className="border-b border-gray-50 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {market.marketCode}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{market.clientName}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium max-w-[180px] truncate">
                            {market.title}
                          </td>
                          <td className="px-4 py-3">
                            {scoreVal !== null ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${scoreBgColor(scoreVal)}`}
                              >
                                {scoreVal}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {alertCount > 0 ? (
                              <span className="text-red-600 font-medium">{alertCount}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {MARKET_STATUS_LABELS[market.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link href={`/markets/${market.id}/overview`}>
                                Voir <ArrowRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {markets.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          Aucun marché enregistré.{" "}
                          <Link href="/markets/new" className="text-blue-600 hover:underline">
                            Créer le premier
                          </Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Alertes critiques */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Alertes critiques récentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topAlerts.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune alerte critique</p>
                )}
                {topAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-800">
                        {alert.alertType.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[alert.severity]}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{alert.market.marketCode}</p>
                    {alert.project && (
                      <p className="text-xs text-gray-500">{alert.project.projectCode}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {format(alert.detectedAt, "dd/MM/yyyy", { locale: fr })}
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full h-6 text-xs mt-1">
                      <Link href={`/markets/${alert.marketId}/alerts`}>
                        Voir alertes
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
