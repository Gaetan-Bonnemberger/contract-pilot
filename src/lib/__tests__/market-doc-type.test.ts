import { describe, it, expect } from "vitest";
import { detectMarketDocType } from "@/lib/market-doc-type";

describe("detectMarketDocType", () => {
  it("détecte chaque type par mot-clé (insensible à la casse)", () => {
    expect(detectMarketDocType("CCAP_marché.pdf")).toBe("ccap");
    expect(detectMarketDocType("dossier-cctp.docx")).toBe("cctp");
    expect(detectMarketDocType("RC-consultation.pdf")).toBe("rc");
    expect(detectMarketDocType("BPU_lot6.xlsx")).toBe("bpu");
    expect(detectMarketDocType("DQE-2024.xlsx")).toBe("dqe");
    expect(detectMarketDocType("devis_estimatif.xlsx")).toBe("dqe");
  });

  it("reconnaît l'acte d'engagement (phrase ou sigle AE)", () => {
    expect(detectMarketDocType("Acte d'engagement signé.pdf")).toBe("ae");
    expect(detectMarketDocType("marche_AE.pdf")).toBe("ae");
  });

  it("évite les faux positifs sur les tokens courts", () => {
    expect(detectMarketDocType("marché_cadre.pdf")).toBe("unknown"); // 'rc' dans 'marché' ignoré
    expect(detectMarketDocType("plan.pdf")).toBe("unknown");
  });
});
