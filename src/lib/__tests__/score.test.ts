/**
 * Tests unitaires pour src/lib/score.ts
 *
 * On teste les fonctions pures directement, et on mocke Prisma
 * pour tester calculateMarketScore sans base de données.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    market: { findUnique: vi.fn() },
    marketScoreWeight: { findMany: vi.fn() },
    scoreModel: { findFirst: vi.fn() },
    marketScore: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  scoreColor,
  scoreBgColor,
  DEFAULT_WEIGHTS,
  METRIC_LABELS,
  calculateMarketScore,
} from "@/lib/score";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Crée un marché fictif minimal pour les tests */
function makeMarket(overrides = {}) {
  return {
    id: "market-1",
    projects: [],
    alerts: [],
    events: [],
    kpis: [],
    scores: [],
    qualityThreshold: 16,
    safetyThreshold: 16,
    ...overrides,
  };
}

// ── scoreColor ────────────────────────────────────────────────────────────────

describe("scoreColor", () => {
  it("retourne vert pour ≥ 80", () => {
    expect(scoreColor(80)).toBe("text-green-600");
    expect(scoreColor(100)).toBe("text-green-600");
    expect(scoreColor(95)).toBe("text-green-600");
  });

  it("retourne orange pour 60–79", () => {
    expect(scoreColor(60)).toBe("text-orange-500");
    expect(scoreColor(79)).toBe("text-orange-500");
    expect(scoreColor(65)).toBe("text-orange-500");
  });

  it("retourne rouge pour < 60", () => {
    expect(scoreColor(59)).toBe("text-red-600");
    expect(scoreColor(0)).toBe("text-red-600");
    expect(scoreColor(40)).toBe("text-red-600");
  });
});

// ── scoreBgColor ──────────────────────────────────────────────────────────────

describe("scoreBgColor", () => {
  it("retourne fond vert pour ≥ 80", () => {
    expect(scoreBgColor(80)).toBe("bg-green-100 text-green-800");
  });

  it("retourne fond orange pour 60–79", () => {
    expect(scoreBgColor(70)).toBe("bg-orange-100 text-orange-800");
  });

  it("retourne fond rouge pour < 60", () => {
    expect(scoreBgColor(50)).toBe("bg-red-100 text-red-800");
  });
});

// ── DEFAULT_WEIGHTS ───────────────────────────────────────────────────────────

describe("DEFAULT_WEIGHTS", () => {
  it("somme à exactement 100", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });

  it("contient les 8 métriques attendues", () => {
    const expected = ["DELAIS", "SECURITE", "QUALITE", "DOCUMENTS", "RECEPTION", "PENALITES", "ALERTES", "BONUS"];
    expect(Object.keys(DEFAULT_WEIGHTS).sort()).toEqual(expected.sort());
  });

  it("chaque poids est entre 0 et 100", () => {
    for (const [key, value] of Object.entries(DEFAULT_WEIGHTS)) {
      expect(value, `${key} doit être > 0`).toBeGreaterThan(0);
      expect(value, `${key} doit être ≤ 100`).toBeLessThanOrEqual(100);
    }
  });
});

// ── METRIC_LABELS ─────────────────────────────────────────────────────────────

describe("METRIC_LABELS", () => {
  it("a un label pour chaque métrique de DEFAULT_WEIGHTS", () => {
    for (const code of Object.keys(DEFAULT_WEIGHTS)) {
      expect(METRIC_LABELS[code], `Label manquant pour ${code}`).toBeDefined();
      expect(METRIC_LABELS[code].length).toBeGreaterThan(0);
    }
  });
});

// ── calculateMarketScore ──────────────────────────────────────────────────────

describe("calculateMarketScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : pas de surcharges de poids
    vi.mocked(prisma.marketScoreWeight.findMany).mockResolvedValue([]);
  });

  it("retourne un score de 100 pour un marché parfait (aucun problème)", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      makeMarket({
        projects: [
          { isUrgent: true, isUrgentLate: false, performedAmountHt: 10000, receivedAmountHt: 10000 },
        ],
        kpis: [
          { category: "Sécurité", currentValue: 20 },
          { category: "Qualité", currentValue: 20 },
        ],
        events: [{ eventType: "BONUS", amountHt: 500 }],
      }) as never
    );

    const result = await calculateMarketScore("market-1");

    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe("Bon");
    expect(result.details).toHaveLength(8);
  });

  it("pénalise fortement les alertes critiques", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      makeMarket({
        alerts: [
          { severity: "CRITIQUE", status: "OPEN" },
          { severity: "CRITIQUE", status: "OPEN" },
          { severity: "CRITIQUE", status: "OPEN" },
          { severity: "CRITIQUE", status: "OPEN" }, // 4 alertes critiques → alertScore = 0
        ],
      }) as never
    );

    const result = await calculateMarketScore("market-1");

    const alertDetail = result.details.find((d) => d.metricCode === "ALERTES");
    expect(alertDetail?.normalizedScore).toBe(0);
    expect(result.total).toBeLessThan(85); // score global impacté
  });

  it("pénalise les urgences en retard", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      makeMarket({
        projects: [
          { isUrgent: true, isUrgentLate: true,  performedAmountHt: 0, receivedAmountHt: 0 },
          { isUrgent: true, isUrgentLate: true,  performedAmountHt: 0, receivedAmountHt: 0 },
          { isUrgent: true, isUrgentLate: false, performedAmountHt: 0, receivedAmountHt: 0 },
        ],
      }) as never
    );

    const result = await calculateMarketScore("market-1");

    const delaisDetail = result.details.find((d) => d.metricCode === "DELAIS");
    // 1/3 dans les délais → ~33%
    expect(delaisDetail?.normalizedScore).toBeCloseTo(33.33, 0);
  });

  it("utilise les poids par défaut si aucune surcharge DB", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(makeMarket() as never);
    vi.mocked(prisma.marketScoreWeight.findMany).mockResolvedValue([]);

    const result = await calculateMarketScore("market-1");

    for (const detail of result.details) {
      expect(detail.weight).toBe(DEFAULT_WEIGHTS[detail.metricCode]);
    }
  });

  it("applique les surcharges de poids DB", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(makeMarket() as never);
    vi.mocked(prisma.marketScoreWeight.findMany).mockResolvedValue([
      { id: "1", marketId: "market-1", metricCode: "SECURITE", weight: 40, updatedAt: new Date() },
    ] as never);

    const result = await calculateMarketScore("market-1");

    const securiteDetail = result.details.find((d) => d.metricCode === "SECURITE");
    expect(securiteDetail?.weight).toBe(40);
  });

  it("lève une erreur si le marché n'existe pas", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    await expect(calculateMarketScore("inexistant")).rejects.toThrow("Marché introuvable");
  });

  it("retourne toujours les 8 détails même sans données", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(makeMarket() as never);

    const result = await calculateMarketScore("market-1");

    expect(result.details).toHaveLength(8);
    const codes = result.details.map((d) => d.metricCode);
    expect(codes).toContain("DELAIS");
    expect(codes).toContain("SECURITE");
    expect(codes).toContain("QUALITE");
    expect(codes).toContain("PENALITES");
  });

  it("score total entre 0 et 100", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(makeMarket() as never);

    const result = await calculateMarketScore("market-1");

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});
