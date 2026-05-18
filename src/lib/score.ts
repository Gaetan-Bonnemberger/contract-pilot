import { prisma } from "@/lib/prisma";

// Poids par défaut (doivent sommer à 100)
export const DEFAULT_WEIGHTS: Record<string, number> = {
  DELAIS:    20,
  SECURITE:  20,
  QUALITE:   15,
  DOCUMENTS: 15,
  RECEPTION: 10,
  PENALITES: 10,
  ALERTES:    5,
  BONUS:      5,
};

export const METRIC_LABELS: Record<string, string> = {
  DELAIS:    "Délais",
  SECURITE:  "Sécurité",
  QUALITE:   "Qualité",
  DOCUMENTS: "Documents",
  RECEPTION: "Réception",
  PENALITES: "Pénalités",
  ALERTES:   "Alertes/Risques",
  BONUS:     "Bonus/Opportunités",
};

/** Charge les poids d'un marché : surcharges DB + fallback sur les défauts */
export async function loadWeights(marketId: string): Promise<Record<string, number>> {
  const overrides = await prisma.marketScoreWeight.findMany({
    where: { marketId },
  });

  const weights = { ...DEFAULT_WEIGHTS };
  for (const row of overrides) {
    if (weights[row.metricCode] !== undefined) {
      weights[row.metricCode] = Number(row.weight);
    }
  }
  return weights;
}

export interface ScoreDetail {
  metricCode: string;
  label: string;
  weight: number;
  rawValue: number;
  normalizedScore: number; // 0-100
  weightedScore: number;
  color: "green" | "orange" | "red";
}

export interface MarketScoreResult {
  total: number;
  label: string;
  details: ScoreDetail[];
}

// Calcule le score santé d'un marché
export async function calculateMarketScore(
  marketId: string
): Promise<MarketScoreResult> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      projects: true,
      alerts: { where: { status: { not: "CLOSED" } } },
      events: true,
      kpis: true,
      scores: { include: { scoreModel: true }, orderBy: { calculatedAt: "desc" }, take: 1 },
    },
  });

  if (!market) throw new Error("Marché introuvable");

  const projects = market.projects;
  const totalProjects = projects.length;

  // --- Calculs bruts ---

  // 1. Délais : taux urgences dans délai
  const urgentProjects = projects.filter((p) => p.isUrgent);
  const urgentOnTime = urgentProjects.filter((p) => !p.isUrgentLate);
  const delaisScore =
    urgentProjects.length > 0
      ? (urgentOnTime.length / urgentProjects.length) * 100
      : 100;

  // 2. Sécurité : basé sur note sécurité des KPI
  const safetyKpi = market.kpis.find((k) => k.category === "Sécurité");
  const safetyThreshold = Number(market.safetyThreshold ?? 16);
  const safetyValue = safetyKpi?.currentValue
    ? Number(safetyKpi.currentValue)
    : safetyThreshold;
  const safetyScore = Math.min((safetyValue / 20) * 100, 100);

  // 3. Qualité : basé sur note qualité des KPI
  const qualityKpi = market.kpis.find((k) => k.category === "Qualité");
  const qualityThreshold = Number(market.qualityThreshold ?? 16);
  const qualityValue = qualityKpi?.currentValue
    ? Number(qualityKpi.currentValue)
    : qualityThreshold;
  const qualityScore = Math.min((qualityValue / 20) * 100, 100);

  // 4. Documents : taux documents complets
  const docsKpi = market.kpis.find((k) => k.category === "Conformité");
  const docsScore = docsKpi?.currentValue ? Number(docsKpi.currentValue) : 50;

  // 5. Réception : taux montants réceptionnés
  const totalPerformed = projects.reduce(
    (sum, p) => sum + Number(p.performedAmountHt),
    0
  );
  const totalReceived = projects.reduce(
    (sum, p) => sum + Number(p.receivedAmountHt),
    0
  );
  const receptionScore =
    totalPerformed > 0 ? (totalReceived / totalPerformed) * 100 : 100;

  // 6. Pénalités : pénalités vs montants réalisés (inverse)
  const totalPenalties = market.events
    .filter((e) => e.eventType === "PENALITE")
    .reduce((sum, e) => sum + Number(e.amountHt), 0);
  const penaltyRatio =
    totalPerformed > 0 ? totalPenalties / totalPerformed : 0;
  const penaltyScore = Math.max(0, 100 - penaltyRatio * 1000); // 0.1% pénalité = -100pts

  // 7. Alertes / risques
  const criticalAlerts = market.alerts.filter(
    (a) => a.severity === "CRITIQUE"
  ).length;
  const alertScore = Math.max(0, 100 - criticalAlerts * 25);

  // 8. Bonus
  const totalBonus = market.events
    .filter((e) => e.eventType === "BONUS")
    .reduce((sum, e) => sum + Number(e.amountHt), 0);
  const bonusScore = Math.min(totalBonus > 0 ? 100 : 50, 100);

  // --- Pondérations (surcharges par marché + défauts) ---
  const w = await loadWeights(marketId);

  const details: ScoreDetail[] = [
    {
      metricCode: "DELAIS",
      label: METRIC_LABELS.DELAIS,
      weight: w.DELAIS,
      rawValue: delaisScore,
      normalizedScore: delaisScore,
      weightedScore: (delaisScore * w.DELAIS) / 100,
      color: delaisScore >= 95 ? "green" : delaisScore >= 80 ? "orange" : "red",
    },
    {
      metricCode: "SECURITE",
      label: METRIC_LABELS.SECURITE,
      weight: w.SECURITE,
      rawValue: safetyValue,
      normalizedScore: safetyScore,
      weightedScore: (safetyScore * w.SECURITE) / 100,
      color: safetyScore >= 80 ? "green" : safetyScore >= 60 ? "orange" : "red",
    },
    {
      metricCode: "QUALITE",
      label: METRIC_LABELS.QUALITE,
      weight: w.QUALITE,
      rawValue: qualityValue,
      normalizedScore: qualityScore,
      weightedScore: (qualityScore * w.QUALITE) / 100,
      color: qualityScore >= 80 ? "green" : qualityScore >= 60 ? "orange" : "red",
    },
    {
      metricCode: "DOCUMENTS",
      label: METRIC_LABELS.DOCUMENTS,
      weight: w.DOCUMENTS,
      rawValue: docsScore,
      normalizedScore: docsScore,
      weightedScore: (docsScore * w.DOCUMENTS) / 100,
      color: docsScore >= 95 ? "green" : docsScore >= 80 ? "orange" : "red",
    },
    {
      metricCode: "RECEPTION",
      label: METRIC_LABELS.RECEPTION,
      weight: w.RECEPTION,
      rawValue: receptionScore,
      normalizedScore: receptionScore,
      weightedScore: (receptionScore * w.RECEPTION) / 100,
      color: receptionScore >= 70 ? "green" : receptionScore >= 40 ? "orange" : "red",
    },
    {
      metricCode: "PENALITES",
      label: METRIC_LABELS.PENALITES,
      weight: w.PENALITES,
      rawValue: totalPenalties,
      normalizedScore: penaltyScore,
      weightedScore: (penaltyScore * w.PENALITES) / 100,
      color: penaltyScore >= 80 ? "green" : penaltyScore >= 50 ? "orange" : "red",
    },
    {
      metricCode: "ALERTES",
      label: METRIC_LABELS.ALERTES,
      weight: w.ALERTES,
      rawValue: criticalAlerts,
      normalizedScore: alertScore,
      weightedScore: (alertScore * w.ALERTES) / 100,
      color: alertScore >= 75 ? "green" : alertScore >= 50 ? "orange" : "red",
    },
    {
      metricCode: "BONUS",
      label: METRIC_LABELS.BONUS,
      weight: w.BONUS,
      rawValue: totalBonus,
      normalizedScore: bonusScore,
      weightedScore: (bonusScore * w.BONUS) / 100,
      color: bonusScore >= 75 ? "green" : bonusScore >= 50 ? "orange" : "red",
    },
  ];

  const total = Math.round(
    details.reduce((sum, d) => sum + d.weightedScore, 0)
  );

  const label =
    total >= 80
      ? "Bon"
      : total >= 60
      ? "Sous surveillance"
      : total >= 40
      ? "En difficulté"
      : "Critique";

  return { total, label, details };
}

export function scoreColor(value: number): string {
  if (value >= 80) return "text-green-600";
  if (value >= 60) return "text-orange-500";
  return "text-red-600";
}

export function scoreBgColor(value: number): string {
  if (value >= 80) return "bg-green-100 text-green-800";
  if (value >= 60) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}
