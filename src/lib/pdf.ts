/**
 * pdf.ts — Extraction de texte depuis un buffer PDF
 *
 * Utilise pdf-parse pour lire le contenu textuel d'un PDF.
 * En cas d'échec (PDF scanné, protégé, etc.) retourne une chaîne vide
 * afin de ne pas bloquer le reste de l'analyse.
 */

/**
 * Extrait le texte brut d'un buffer PDF.
 * @returns Le texte extrait, ou "" si l'extraction échoue.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Import dynamique pour éviter les problèmes SSR avec le module CJS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
    const data = await pdfParse(buffer, {
      // Limiter la consommation mémoire sur de gros PDF
      max: 0, // 0 = toutes les pages
    });

    const text = data.text ?? "";

    // Nettoyage basique : supprimer les lignes vides excessives
    return text
      .replace(/\n{4,}/g, "\n\n\n")
      .replace(/[ \t]{3,}/g, "  ")
      .trim();
  } catch (err) {
    console.error("[extractPdfText] Échec de l'extraction PDF :", err);
    return "";
  }
}

/**
 * Extrait le texte d'un File (FormData) en fonction du type MIME.
 * Gère PDF, texte brut, et les types non supportés (fallback vide).
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

  // .doc/.docx — extraction non supportée sans librairie dédiée
  console.warn(`[extractFileText] Type de fichier non supporté : ${file.type}`);
  return `[Fichier : ${file.name} — extraction de texte non disponible pour ce format. Fournissez un PDF ou un fichier texte pour une analyse optimale.]`;
}
