/**
 * pdf.ts — Extraction de texte depuis un buffer PDF
 *
 * Utilise pdf-parse (v2) pour lire le contenu textuel d'un PDF.
 * En cas d'échec (PDF scanné, protégé, etc.) retourne une chaîne vide
 * afin de ne pas bloquer le reste de l'analyse.
 *
 * pdf-parse v2 expose une CLASSE `PDFParse` (et non plus une fonction
 * appelable comme en v1). L'ancien `require("pdf-parse")(buffer)` renvoyait
 * un objet non-appelable -> exception -> texte vide -> l'app croyait le PDF
 * scanne. On utilise donc `new PDFParse({ data: buffer }).getText()`.
 */

/**
 * Extrait le texte brut d'un buffer PDF.
 * @returns Le texte extrait, ou "" si l'extraction echoue.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Import dynamique pour eviter les soucis SSR avec le module CJS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text ?? "";

      // Nettoyage basique : supprimer les lignes vides excessives
      return text
        .replace(/\n{4,}/g, "\n\n\n")
        .replace(/[ \t]{3,}/g, "  ")
        .trim();
    } finally {
      // Libere les ressources du parseur (worker pdf.js)
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  } catch (err) {
    console.error("[extractPdfText] Echec de l'extraction PDF :", err);
    return "";
  }
}

/**
 * Extrait le texte d'un File (FormData) en fonction du type MIME.
 * Gere PDF, texte brut, et les types non supportes (fallback vide).
 */
export async function extractFileText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    file.type.startsWith("text/") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".md")
  ) {
    return buffer.toString("utf-8");
  }

  // .doc/.docx — extraction non supportee sans librairie dediee
  console.warn(`[extractFileText] Type de fichier non supporte : ${file.type}`);
  return `[Fichier : ${file.name} — extraction de texte non disponible pour ce format. Fournissez un PDF ou un fichier texte pour une analyse optimale.]`;
}