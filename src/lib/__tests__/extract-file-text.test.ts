/**
 * Routage d'extraction par extension dans extractFileText.
 * xlsx et mammoth sont mockés (import statique ESM -> intercepté par vitest).
 * Le cas PDF est vérifié via le throw réel de pdf-parse sur un PDF invalide
 * (extractPdfText utilise require() et n'est volontairement pas modifié).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("xlsx", () => ({
  read: vi.fn(() => ({ SheetNames: ["BPU"], Sheets: { BPU: {} } })),
  utils: { sheet_to_csv: vi.fn(() => "Article;PU\nTerrassement;120") },
}));
vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn(async () => ({ value: "texte du docx", messages: [] })) },
}));

import { extractFileText } from "@/lib/pdf";
import mammoth from "mammoth";

function fileOf(name: string, content = "x", type = "") {
  return new File([content], name, { type });
}

beforeEach(() => vi.clearAllMocks());

describe("extractFileText — routage par extension", () => {
  it(".pdf → routé vers extractPdfText (throw sur PDF invalide)", async () => {
    await expect(
      extractFileText(fileOf("ccap.pdf", "pas un vrai pdf", "application/pdf"))
    ).rejects.toThrow();
  });

  it(".xlsx → une section par feuille (CSV)", async () => {
    const out = await extractFileText(fileOf("bpu.xlsx"));
    expect(out).toContain("=== Feuille: BPU ===");
    expect(out).toContain("Terrassement;120");
  });

  it(".docx → mammoth", async () => {
    expect(await extractFileText(fileOf("ae.docx"))).toBe("texte du docx");
  });

  it(".doc → tente aussi mammoth (docx mal nommé)", async () => {
    expect(await extractFileText(fileOf("ae.doc"))).toBe("texte du docx");
    expect(mammoth.extractRawText).toHaveBeenCalled();
  });

  it(".doc binaire ancien (mammoth échoue) → placeholder, sans throw", async () => {
    vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error("OLE binaire"));
    expect(await extractFileText(fileOf("vieux.doc"))).toBe(
      "[Fichier .doc ancien non supporté — convertir en .docx ou PDF]"
    );
  });

  it(".txt → utf-8", async () => {
    expect(await extractFileText(fileOf("notes.txt", "bonjour", "text/plain"))).toBe("bonjour");
  });

  it("type inconnu → placeholder générique", async () => {
    expect(await extractFileText(fileOf("archive.zip", "x", "application/zip"))).toContain(
      "extraction de texte non disponible"
    );
  });
});
