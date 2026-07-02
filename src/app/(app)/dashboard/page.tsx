import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Building2,
  FileText,
  Euro,
  ArrowRight,
  CheckSquare,
  ShieldAlert,
} from "@/components/icons";
import { scoreBgColor, scoreColor } from "@/lib/score";
import { marketCodeLabel } from "@/lib/market-code";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Couleurs statut ───────────────────────────────────────────────────────────
const MARKET_STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-gray-600",
  ACTIVE:   "bg-green-100 text-green-800",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
  CLOSED:   "bg-gray-200 text-gray-600",
};
const MARKET_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon", ACTIVE: "Actif", ARCHIVED: "Archivé", CLOSED: "Clôturé",
};
const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  MAJEUR:   "bg-orange-100 text-orange-800",
  MINEUR:   "bg-yellow-100 text-yellow-700",
};
const NC_SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-700",
  MAJEURE:  "bg-orange-100 text-orange-700",
  MINEURE:  "bg-yellow-100 text-yellow-700",
};
const ACTION_PRIORITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-700",
  HAUTE:    "bg-orange-100 text-orange-700",
  MOYENNE:  "bg-blue-100 text-blue-700",
  BASSE:    "bg-gray-100 text-gray-600",
};

// ── Composant distribution SVG ────────────────────────────────────────────────
function ScoreDistributionChart({
  bon, surveillance, difficulte, critique,
}: { bon: number; surveillance: number; difficulte: number; critique: number }) {
  const total = bon + surveillance + difficulte + critique;
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-4">Aucun score calculé</p>;

  const bars = [
    { label: "Bon (≥80)", count: bon,          color: "#16a34a", bg: "bg-green-500" },
    { label: "Surveillance (60–79)", count: surveillance, color: "#f97316", bg: "bg-orange-400" },
    { label: "En difficulté (40–59)", count: difficulte,  color: "#dc2626", bg: "bg-red-500" },
    { label: "Critique (<40)", count: critique,   color: "#991b1b", bg: "bg-red-800" },
  ];

  return (
    <div className="space-y-3">
      {bars.map((b) => (
        <div key={b.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{b.label}</span>
            <span className="font-semibold" style={{ color: b.color }}>{b.count}</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full ${b.bg} transition-all`}
              style={{ width: `${total > 0 ? (b.count / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 text-right">{total} marché(s) scoré(s)</p>
    </div>
  );
}

// ── Mini sparkline SVG (7 derniers scores d'un marché) ────────────────────────
function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 60, H = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const color = last >= 80 ? "#16a34a" : last >= 60 ? "#f97316" : "#dc2626";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-70">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();

  const [
    activeMarkets,
    draftMarkets,
    criticalAlerts,
    recentPenalties,
    totalBonus,
    overdueActions,
    openNcs,
    ncBySeverity,
    markets,
    topAlerts,
    topNcs,
    urgentActions,
    latestScores,
  ] = await Promise.all([
    // Compteurs marchés
    prisma.market.count({ where: { status: "ACTIVE" } }),
    prisma.market.count({ where: { status: "DRAFT" } }),
    // Alertes critiques ouvertes
    prisma.alert.count({ where: { status: { not: "CLOSED" }, severity: "CRITIQUE" } }),
    // Pénalités cumulées
    prisma.marketEvent.aggregate({
      where: { eventType: "PENALITE" },
      _sum: { amountHt: true },
    }),
    // Bonus cumulés
    prisma.marketEvent.aggregate({
      where: { eventType: "BONUS" },
      _sum: { amountHt: true },
    }),
    // Actions en retard (deadline dépassée et non terminées)
    prisma.actionPlan.count({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        targetDate: { lt: now },
      },
    }),
    // NC ouvertes
    prisma.nonConformite.count({ where: { status: { not: "CLOTUREE" } } }),
    // NC par sévérité
    prisma.nonConformite.groupBy({
      by: ["severity"],
      where: { status: { not: "CLOTUREE" } },
      _count: { _all: true },
    }),
    // Liste marchés (actifs + brouillon)
    prisma.market.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      include: {
        responsibleUser: { select: { firstName: true, lastName: true } },
        alerts: { where: { status: { not: "CLOSED" } } },
        _count: {
          select: {
            projects: true,
            nonConformites: { where: { status: { not: "CLOTUREE" } } },
          },
        },
        scores: {
          orderBy: { calculatedAt: "desc" },
          take: 7,
          select: { scoreValue: true, scoreLabel: true, calculatedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Top alertes critiques
    prisma.alert.findMany({
      where: { status: { not: "CLOSED" }, severity: "CRITIQUE" },
      include: { market: { select: { id: true, marketCode: true, title: true } }, project: { select: { projectCode: true } } },
      orderBy: { detectedAt: "desc" },
      take: 5,
    }),
    // NC récentes ouvertes
    prisma.nonConformite.findMany({
      where: { status: { not: "CLOTUREE" } },
      include: { market: { select: { id: true, marketCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Actions urgentes (en retard)
    prisma.actionPlan.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        targetDate: { lt: now },
      },
      include: { market: { select: { id: true, marketCode: true } } },
      orderBy: { targetDate: "asc" },
      take: 5,
    }),
    // Tous les derniers scores par marché (pour la distribution)
    prisma.marketScore.findMany({
      distinct: ["marketId"],
      orderBy: { calculatedAt: "desc" },
      select: { marketId: true, scoreValue: true, scoreLabel: true },
    }),
  ]);

  // ── Calculs dérivés ──────────────────────────────────────────────────────────
  const totalPenalties = Number(recentPenalties._sum.amountHt ?? 0);
  const totalBonusAmt = Number(totalBonus._sum.amountHt ?? 0);

  // Score moyen global
  const avgScore =
    latestScores.length > 0
      ? Math.round(latestScores.reduce((s, r) => s + Number(r.scoreValue), 0) / latestScores.length)
      : null;

  // Distribution des scores
  const dist = { bon: 0, surveillance: 0, difficulte: 0, critique: 0 };
  for (const s of latestScores) {
    const v = Number(s.scoreValue);
    if (v >= 80) dist.bon++;
    else if (v >= 60) dist.surveillance++;
    else if (v >= 40) dist.difficulte++;
    else dist.critique++;
  }

  // NC par sévérité (map)
  const ncMap: Record<string, number> = {};
  for (const r of ncBySeverity) ncMap[r.severity] = r._count._all;

  // Marchés triés par score (pires en premier)
  const latestScoreById: Record<string, number> = {};
  for (const s of latestScores) latestScoreById[s.marketId] = Number(s.scoreValue);
  const sortedMarkets = [...markets].sort((a, b) => {
    const sa = latestScoreById[a.id] ?? 999;
    const sb = latestScoreById[b.id] ?? 999;
    return sa - sb;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Dashboard"
        subtitle={`Vue globale · ${format(now, "EEEE d MMMM yyyy", { locale: fr })}`}
        actions={
          <Button asChild size="sm">
            <Link href="/markets/new">+ Nouveau marché</Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Ligne 1 : KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-6 gap-3">

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Marchés actifs</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{activeMarkets}</p>
                  {draftMarkets > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{draftMarkets} brouillon(s)</p>
                  )}
                </div>
                <Building2 className="h-7 w-7 text-blue-200 mt-0.5" />
              </div>
            </CardContent>
          </Card>

          <Card className={avgScore !== null && avgScore < 60 ? "border-red-200" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Score moyen</p>
                  {avgScore !== null ? (
                    <p className={`text-2xl font-bold mt-0.5 ${scoreColor(avgScore)}`}>{avgScore}</p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-300 mt-0.5">—</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">sur 100</p>
                </div>
                <FileText className="h-7 w-7 text-blue-200 mt-0.5" />
              </div>
            </CardContent>
          </Card>

          <Card className={criticalAlerts > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Alertes critiques</p>
                  <p className={`text-2xl font-bold mt-0.5 ${criticalAlerts > 0 ? "text-red-600" : "text-gray-900"}`}>
                    {criticalAlerts}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">ouvertes</p>
                </div>
                <AlertTriangle className={`h-7 w-7 mt-0.5 ${criticalAlerts > 0 ? "text-red-300" : "text-gray-200"}`} />
              </div>
            </CardContent>
          </Card>

          <Card className={openNcs > 0 ? "border-orange-200" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">NC QHSE ouvertes</p>
                  <p className={`text-2xl font-bold mt-0.5 ${openNcs > 0 ? "text-orange-600" : "text-gray-900"}`}>
                    {openNcs}
                  </p>
                  {(ncMap["CRITIQUE"] ?? 0) > 0 && (
                    <p className="text-xs text-red-600 mt-0.5">{ncMap["CRITIQUE"]} critique(s)</p>
                  )}
                </div>
                <ShieldAlert className={`h-7 w-7 mt-0.5 ${openNcs > 0 ? "text-orange-200" : "text-gray-200"}`} />
              </div>
            </CardContent>
          </Card>

          <Card className={overdueActions > 0 ? "border-orange-200" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Actions en retard</p>
                  <p className={`text-2xl font-bold mt-0.5 ${overdueActions > 0 ? "text-orange-600" : "text-gray-900"}`}>
                    {overdueActions}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">échéance dépassée</p>
                </div>
                <CheckSquare className={`h-7 w-7 mt-0.5 ${overdueActions > 0 ? "text-orange-200" : "text-gray-200"}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pénalités cumulées</p>
                  <p className={`text-xl font-bold mt-0.5 ${totalPenalties > 0 ? "text-red-700" : "text-gray-900"}`}>
                    {totalPenalties.toLocaleString("fr-FR")} €
                  </p>
                  {totalBonusAmt > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">
                      +{totalBonusAmt.toLocaleString("fr-FR")} € bonus
                    </p>
                  )}
                </div>
                <Euro className="h-7 w-7 text-gray-200 mt-0.5" />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Ligne 2 : Table marchés + panneau droit ──────────────────────── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Table marchés (2/3) */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Marchés actifs &amp; brouillons
                  <span className="ml-2 text-xs font-normal text-gray-400">({markets.length})</span>
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                  <Link href="/markets">Tous <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">Code</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">Marché</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">Score</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-400">Alertes</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-400">NC</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Responsable</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMarkets.map((market) => {
                        const scoreVal = latestScoreById[market.id] ?? null;
                        const sparklineVals = [...market.scores]
                          .reverse()
                          .map((s) => Number(s.scoreValue));
                        const alertCount = market.alerts.length;
                        const ncCount = market._count.nonConformites;
                        const hasCriticalAlert = market.alerts.some((a) => a.severity === "CRITIQUE");

                        return (
                          <tr
                            key={market.id}
                            className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                              hasCriticalAlert ? "bg-red-50/30" : ""
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {hasCriticalAlert && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                )}
                                <span className="font-mono text-xs text-blue-700">{marketCodeLabel(market.marketCode)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-medium text-gray-900 max-w-[140px] truncate">{market.title}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[140px]">{market.clientName}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {scoreVal !== null ? (
                                  <>
                                    <span className={`text-xs font-bold w-6 text-right ${scoreColor(scoreVal)}`}>
                                      {scoreVal}
                                    </span>
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${scoreVal}%`,
                                          backgroundColor:
                                            scoreVal >= 80 ? "#16a34a" : scoreVal >= 60 ? "#f97316" : "#dc2626",
                                        }}
                                      />
                                    </div>
                                    <MiniSparkline values={sparklineVals} />
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {alertCount > 0 ? (
                                <span className={`text-xs font-bold ${hasCriticalAlert ? "text-red-600" : "text-orange-500"}`}>
                                  {alertCount}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {ncCount > 0 ? (
                                <span className="text-xs font-bold text-orange-500">{ncCount}</span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {market.responsibleUser ? (
                                <span className="text-xs text-gray-600 truncate block max-w-[90px]">
                                  {market.responsibleUser.firstName} {market.responsibleUser.lastName}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <Link
                                href={`/markets/${market.id}/overview`}
                                className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800"
                              >
                                Voir <ArrowRight className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {markets.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                            Aucun marché.{" "}
                            <Link href="/markets/new" className="text-blue-600 hover:underline">
                              Créer le premier
                            </Link>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panneau droit (1/3) */}
          <div className="space-y-4">

            {/* Alertes critiques */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  Alertes critiques
                  {criticalAlerts > 0 && (
                    <span className="ml-auto text-xs font-normal text-red-500">{criticalAlerts} ouvertes</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {topAlerts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Aucune alerte critique ✓</p>
                ) : (
                  topAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/markets/${alert.marketId}/alerts`}
                      className="block rounded-lg border border-red-100 bg-red-50 p-2.5 hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold text-red-800 leading-tight">
                          {alert.alertType.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {format(alert.detectedAt, "d MMM", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {marketCodeLabel(alert.market.marketCode)}
                        {alert.project && ` · ${alert.project.projectCode}`}
                      </p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* NC QHSE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                  NC QHSE récentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {topNcs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Aucune NC ouverte ✓</p>
                ) : (
                  topNcs.map((nc) => (
                    <Link
                      key={nc.id}
                      href={`/markets/${nc.marketId}/nc`}
                      className="block rounded-lg border border-orange-100 bg-orange-50 p-2.5 hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-medium text-gray-800 leading-tight truncate max-w-[130px]">
                          {nc.description}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${NC_SEVERITY_COLORS[nc.severity]}`}>
                          {nc.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{marketCodeLabel(nc.market.marketCode)} · {nc.ncType}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* ── Ligne 3 : Distribution scores + Actions urgentes ─────────────── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Distribution des scores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribution des scores</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScoreDistributionChart {...dist} />
            </CardContent>
          </Card>

          {/* Actions en retard */}
          <Card className={overdueActions > 0 ? "border-orange-200" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-orange-500" />
                Actions en retard
                {overdueActions > 0 && (
                  <span className="ml-auto text-xs font-normal text-orange-500">{overdueActions} au total</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {urgentActions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucune action en retard ✓</p>
              ) : (
                urgentActions.map((action) => {
                  const daysLate = Math.floor(
                    (now.getTime() - new Date(action.targetDate!).getTime()) / 86400000
                  );
                  return (
                    <Link
                      key={action.id}
                      href={`/markets/${action.marketId}/actions`}
                      className="block rounded-lg border border-orange-100 bg-orange-50 p-2.5 hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-medium text-gray-800 leading-tight truncate max-w-[140px]">
                          {action.title}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${ACTION_PRIORITY_COLORS[action.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {action.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{marketCodeLabel(action.market.marketCode)}</span>
                        <span className="text-xs text-red-600 font-medium">+{daysLate}j de retard</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Santé globale — résumé texte */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Synthèse santé</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Score global */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Score moyen global</span>
                {avgScore !== null ? (
                  <span className={`text-sm font-bold ${scoreColor(avgScore)}`}>{avgScore}/100</span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>

              {/* Marchés en difficulté */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Marchés en difficulté</span>
                <span className={`text-sm font-bold ${dist.difficulte + dist.critique > 0 ? "text-red-600" : "text-green-600"}`}>
                  {dist.difficulte + dist.critique}
                </span>
              </div>

              {/* NC par sévérité */}
              <div className="pt-1 border-t border-gray-100 space-y-1">
                <p className="text-xs font-medium text-gray-500 mb-1">NC ouvertes par sévérité</p>
                {(["CRITIQUE", "MAJEURE", "MINEURE"] as const).map((sev) => (
                  <div key={sev} className="flex items-center justify-between">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${NC_SEVERITY_COLORS[sev]}`}>
                      {sev}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{ncMap[sev] ?? 0}</span>
                  </div>
                ))}
              </div>

              {/* Bilan financier */}
              <div className="pt-1 border-t border-gray-100 space-y-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Bilan financier</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Pénalités</span>
                  <span className={`text-xs font-semibold ${totalPenalties > 0 ? "text-red-600" : "text-gray-500"}`}>
                    {totalPenalties.toLocaleString("fr-FR")} €
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Bonus</span>
                  <span className={`text-xs font-semibold ${totalBonusAmt > 0 ? "text-green-600" : "text-gray-500"}`}>
                    +{totalBonusAmt.toLocaleString("fr-FR")} €
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-1 mt-1">
                  <span className="text-xs font-medium text-gray-600">Net</span>
                  <span className={`text-xs font-bold ${totalBonusAmt - totalPenalties >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(totalBonusAmt - totalPenalties) >= 0 ? "+" : ""}
                    {(totalBonusAmt - totalPenalties).toLocaleString("fr-FR")} €
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

      </main>
    </div>
  );
}
