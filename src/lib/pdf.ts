/**
 * pdf.ts — Extraction de texte depuis un buffer PDF
 *
 * Utilise pdf-parse (v2) pour lire le contenu textuel d'un PDF.
 * Distinction importante :
 *   - un PDF réellement sans texte (scanné) : getText() réussit et renvoie ""
 *     -> on retourne "" (signal « pas de texte », pas une erreur) ;
 *   - un échec TECHNIQUE (module cassé, PDF corrompu/protégé, worker pdf.js) :
 *     getText() lève -> on RELANCE l'erreur pour ne pas la confondre avec un
 *     PDF scanné (sinon l'UI affiche « Document scanné » à tort).
 *
 * pdf-parse v2 expose une CLASSE `PDFParse` (et non plus une fonction
 * appelable comme en v1). L'ancien `require("pdf-parse")(buffer)` renvoyait
 * un objet non-appelable -> exception -> texte vide -> l'app croyait le PDF
 * scanne. On utilise donc `new PDFParse({ data: buffer }).getText()`.
 */
import * as XLSX from "xlsx";
import mammoth from "mammoth";

/**
 * Extrait le texte brut d'un buffer PDF.
 * @returns Le texte extrait, ou "" si le PDF ne contient pas de texte (scanné).
 * @throws  En cas d'échec technique de l'extraction (module, worker, PDF corrompu).
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
    // Échec technique : on log et on RELANCE (ne pas retomber en "" qui serait
    // interprété comme un PDF scanné).
    console.error("[extractPdfText] Echec technique de l'extraction PDF :", err);
    throw err instanceof Error
      ? err
      : new Error("Echec technique de l'extraction PDF");
  }
}

/**
 * Extrait le texte d'un tableur Excel (.xlsx/.xls) : une section par feuille,
 * chaque feuille convertie en CSV. Ne throw jamais : renvoie un placeholder
 * explicite en cas d'échec (le reste du dossier doit rester exploitable).
 */
function extractXlsxText(buffer: Buffer, fileName: string): string {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const text = wb.SheetNames
      .map((name) => `=== Feuille: ${name} ===\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`)
      .join("\n\n");
    // Nettoyage : lignes vides excessives
    return text.replace(/\n{4,}/g, "\n\n\n").trim();
  } catch (err) {
    console.error("[extractFileText] Echec extraction Excel :", err);
    return `[Fichier : ${fileName} — échec de l'extraction du tableur Excel]`;
  }
}

/**
 * Extrait le texte d'un document Word. On tente mammoth quelle que soit
 * l'extension (.docx ET .doc) car des .docx sont parfois mal nommés .doc.
 * Un vrai .doc binaire ancien (OLE) fera échouer mammoth -> placeholder,
 * SANS throw.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").replace(/\n{4,}/g, "\n\n\n").trim();
  } catch (err) {
    console.warn("[extractFileText] Echec extraction Word (mammoth) :", err);
    return "[Fichier .doc ancien non supporté — convertir en .docx ou PDF]";
  }
}

/**
 * Extrait le texte d'un File (FormData) selon son extension / type MIME.
 * Gère PDF, Excel (.xlsx/.xls), Word (.docx/.doc), texte brut ; placeholder sinon.
 */
export async function extractFileText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  // PDF
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  // Tableurs Excel (BPU, DQE — porteurs des montants)
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return extractXlsxText(buffer, file.name);
  }

  // Word (.docx, et .doc parfois mal nommés)
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return extractDocxText(buffer);
  }

  // Texte brut
  if (
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return buffer.toString("utf-8");
  }

  // Type inconnu
  console.warn(`[extractFileText] Type de fichier non supporte : ${file.type}`);
  return `[Fichier : ${file.name} — extraction de texte non disponible pour ce format. Fournissez un PDF ou un fichier texte pour une analyse optimale.]`;
}