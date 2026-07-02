/**
 * Tests de POST /api/markets/prefill :
 *  - le mapping résultat d'analyse → champs formulaire ;
 *  - le comportement route (auth, PDF scanné, succès) — LLM et pdf mockés.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisResult } from "@/lib/llm";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pdf", () => ({ extractFileText: vi.fn() }));
vi.mock("@/lib/llm", () => ({ analyzeContract: vi.fn() }));

import { POST } from "@/app/api/markets/prefill/route";
import { mapAnalysisToPrefill, mergePrefills, type MarketPrefill } from "@/app/api/markets/prefill/prefill-mapping";
import { auth } from "@/lib/auth";
import { extractFileText } from "@/lib/pdf";
import { analyzeContract } from "@/lib/llm";

const BASE_RESULT = {
  executiveSummary: "r", criticalClauses: "c", majorRisks: "m",
  financialMechanisms: "f", clarificationsNeeded: "cl",
  extractedClauses: [], extractedKpis: [], extractedObligations: [],
  extractedPenalties: [], extractedBonuses: [],
  financialSummary: { firmAmountHt: 220000, optionAmountHt: 110000, renewalCount: 2 },
  marketIdentification: {
    marketCode: "ECB2303550", clientName: "Enedis",
    title: "Marché-cadre TPE", lotName: "Lot 6", marketType: "Travaux",
  },
} as AnalysisResult;

function fileRequest(content = "contenu") {
  const fd = new FormData();
  fd.append("file", new File([content], "ccap.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/markets/prefill", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "RESPONSABLE_MARCHE" } } as never);
});

describe("mapAnalysisToPrefill", () => {
  it("mappe marketIdentification et financialSummary", () => {
    expect(mapAnalysisToPrefill(BASE_RESULT)).toEqual({
      marketCode: "ECB2303550", clientName: "Enedis", title: "Marché-cadre TPE",
      lotName: "Lot 6", marketType: "Travaux",
      firmAmountHt: 220000, optionAmountHt: 110000, renewalCount: 2,
    });
  });

  it("renvoie des valeurs par défaut quand les blocs sont absents", () => {
    const empty = { ...BASE_RESULT, marketIdentification: {}, financialSummary: {} } as AnalysisResult;
    expect(mapAnalysisToPrefill(empty)).toEqual({
      marketCode: "", clientName: "", title: "", lotName: "", marketType: "",
      firmAmountHt: null, optionAmountHt: null, renewalCount: null,
    });
  });
});

describe("mergePrefills", () => {
  const P = (over: Partial<MarketPrefill>): MarketPrefill => ({
    marketCode: "", clientName: "", title: "", lotName: "", marketType: "",
    firmAmountHt: null, optionAmountHt: null, renewalCount: null, ...over,
  });

  it("le montant vient du DQE même si un AE est fourni", () => {
    const merged = mergePrefills([
      { docType: "ae",  prefill: P({ marketCode: "AE-1", firmAmountHt: 100 }) },
      { docType: "dqe", prefill: P({ firmAmountHt: 999 }) },
    ]);
    expect(merged.firmAmountHt).toBe(999);   // dqe > ae pour les montants
    expect(merged.marketCode).toBe("AE-1");  // ae fournit le code, dqe non
  });

  it("l'identification vient du CCAP", () => {
    const merged = mergePrefills([
      { docType: "cctp", prefill: P({ marketCode: "CCTP-X", title: "T-cctp" }) },
      { docType: "ccap", prefill: P({ marketCode: "CCAP-1", title: "T-ccap" }) },
    ]);
    expect(merged.marketCode).toBe("CCAP-1");
    expect(merged.title).toBe("T-ccap");
  });

  it("n'écrase jamais une valeur non-vide par une vide", () => {
    const merged = mergePrefills([
      { docType: "ccap", prefill: P({ clientName: "Enedis" }) },
      { docType: "ae",   prefill: P({ clientName: "" }) },
      { docType: "dqe",  prefill: null },
    ]);
    expect(merged.clientName).toBe("Enedis");
  });
});

describe("POST /api/markets/prefill", () => {
  it("401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await POST(fileRequest());
    expect(res.status).toBe(401);
    expect(analyzeContract).not.toHaveBeenCalled();
  });

  it("renvoie extractedChars:0 et n'analyse pas si texte vide (PDF scanné)", async () => {
    vi.mocked(extractFileText).mockResolvedValue("");
    const res = await POST(fileRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ extractedChars: 0, docType: "ccap", prefill: null });
    expect(analyzeContract).not.toHaveBeenCalled();
  });

  it("renvoie 500 avec message explicite si l'extraction échoue techniquement", async () => {
    vi.mocked(extractFileText).mockRejectedValue(new Error("pdf-parse cassé"));
    const res = await POST(fileRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain("Échec technique de l'extraction");
    expect(body.error).toContain("pdf-parse cassé");
    expect(analyzeContract).not.toHaveBeenCalled();
  });

  it("renvoie le prefill mappé quand le texte est extrait", async () => {
    vi.mocked(extractFileText).mockResolvedValue("texte du marché");
    vi.mocked(analyzeContract).mockResolvedValue(BASE_RESULT);
    const res = await POST(fileRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.extractedChars).toBe("texte du marché".length);
    expect(body.docType).toBe("ccap");
    expect(body.prefill.marketCode).toBe("ECB2303550");
    expect(body.prefill.firmAmountHt).toBe(220000);
    expect(analyzeContract).toHaveBeenCalledOnce();
  });
});
