import { prisma } from "@/lib/prisma";

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

  // --- Pondérations ---
  const weights = {
    delais: 20,
    securite: 20,
    qualite: 15,
    documents: 15,
    reception: 10,
    penalites: 10,
    alertes: 5,
    bonus: 5,
  };

  const details: ScoreDetail[] = [
    {
      metricCode: "DELAIS",
      label: "Délais",
      weight: weights.delais,
      rawValue: delaisScore,
      normalizedScore: delaisScore,
      weightedScore: (delaisScore * weights.delais) / 100,
      color: delaisScore >= 95 ? "green" : delaisScore >= 80 ? "orange" : "red",
    },
    {
      metricCode: "SECURITE",
      label: "Sécurité",
      weight: weights.securite,
      rawValue: safetyValue,
      normalizedScore: safetyScore,
      weightedScore: (safetyScore * weights.securite) / 100,
      color: safetyScore >= 80 ? "green" : safetyScore >= 60 ? "orange" : "red",
    },
    {
      metricCode: "QUALITE",
      label: "Qualité",
      weight: weights.qualite,
      rawValue: qualityValue,
      normalizedScore: qualityScore,
      weightedScore: (qualityScore * weights.qualite) / 100,
      color: qualityScore >= 80 ? "green" : qualityScore >= 60 ? "orange" : "red",
    },
    {
      metricCode: "DOCUMENTS",
      label: "Documents",
      weight: weights.documents,
      rawValue: docsScore,
      normalizedScore: docsScore,
      weightedScore: (docsScore * weights.documents) / 100,
      color: docsScore >= 95 ? "green" : docsScore >= 80 ? "orange" : "red",
    },
    {
      metricCode: "RECEPTION",
      label: "Réception",
      weight: weights.reception,
      rawValue: receptionScore,
      normalizedScore: receptionScore,
      weightedScore: (receptionScore * weights.reception) / 100,
      color: receptionScore >= 70 ? "green" : receptionScore >= 40 ? "orange" : "red",
    },
    {
      metricCode: "PENALITES",
      label: "Pénalités",
      weight: weights.penalites,
      rawValue: totalPenalties,
      normalizedScore: penaltyScore,
      weightedScore: (penaltyScore * weights.penalites) / 100,
      color: penaltyScore >= 80 ? "green" : penaltyScore >= 50 ? "orange" : "red",
    },
    {
      metricCode: "ALERTES",
      label: "Alertes/Risques",
      weight: weights.alertes,
      rawValue: criticalAlerts,
      normalizedScore: alertScore,
      weightedScore: (alertScore * weights.alertes) / 100,
      color: alertScore >= 75 ? "green" : alertScore >= 50 ? "orange" : "red",
    },
    {
      metricCode: "BONUS",
      label: "Bonus/Opportunités",
      weight: weights.bonus,
      rawValue: totalBonus,
      normalizedScore: bonusScore,
      weightedScore: (bonusScore * weights.bonus) / 100,
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
