/**
 * Vérifie que analyzeContract aiguille vers Ollama quand LLM_PROVIDER=ollama,
 * en mockant fetch (aucun appel réseau réel).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_RESULT = {
  executiveSummary: "résumé",
  criticalClauses: "clauses",
  majorRisks: "risques",
  financialMechanisms: "mécanismes",
  clarificationsNeeded: "clarifications",
  extractedClauses: [],
  extractedKpis: [],
  extractedObligations: [],
  extractedPenalties: [],
  extractedBonuses: [],
  financialSummary: {},
};

describe("analyzeContract — aiguillage provider", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("route vers Ollama quand LLM_PROVIDER=ollama", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.OLLAMA_MODEL = "mistral:7b";
    delete process.env.ANTHROPIC_API_KEY;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: JSON.stringify(VALID_RESULT) } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { analyzeContract } = await import("@/lib/llm");
    const res = await analyzeContract("texte du marché", "contexte");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/chat");
    expect(res.executiveSummary).toBe("résumé");
  });
});
