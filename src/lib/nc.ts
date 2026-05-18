import { prisma } from "@/lib/prisma";
import type { NcSeverity, NcType } from "@prisma/client";

/** Points déduits du KPI selon la gravité */
export const NC_SCORE_IMPACT: Record<NcSeverity, number> = {
  MINEURE:  1,
  MAJEURE:  3,
  CRITIQUE: 5,
};

/** Catégorie KPI ciblée selon le type de NC */
const NC_KPI_CATEGORY: Record<NcType, string[]> = {
  QUALITE:       ["Qualité"],
  SECURITE:      ["Sécurité"],
  ENVIRONNEMENT: ["Qualité", "Environnement"],
};

/**
 * Applique un delta (positif = bonus, négatif = malus) au premier KPI
 * de la catégorie correspondante pour le marché donné.
 * Retourne le delta effectivement appliqué (0 si aucun KPI trouvé).
 */
export async function applyNcImpactToKpi(
  marketId: string,
  ncType: NcType,
  delta: number
): Promise<number> {
  const categories = NC_KPI_CATEGORY[ncType];

  const kpi = await prisma.marketKpi.findFirst({
    where: {
      marketId,
      category: { in: categories },
      currentValue: { not: null },
    },
    orderBy: { category: "asc" },
  });

  if (!kpi || kpi.currentValue === null) return 0;

  const current = Number(kpi.currentValue);
  const newValue = Math.max(0, Math.min(100, current + delta));

  await prisma.marketKpi.update({
    where: { id: kpi.id },
    data: { currentValue: newValue },
  });

  return delta;
}
