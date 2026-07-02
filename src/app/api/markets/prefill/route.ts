/**
 * POST /api/markets/prefill
 * Pré-analyse un document pour PRÉ-REMPLIR le formulaire de création de marché.
 *
 * IMPORTANT : ne crée AUCUN marché et n'écrit RIEN en base.
 * Renvoie seulement les valeurs suggérées ; l'humain relit, corrige et valide
 * via le bouton « Créer le marché » (POST /api/markets, inchangé).
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { analyzeContract } from "@/lib/llm";
import { extractFileText } from "@/lib/pdf";
import { mapAnalysisToPrefill } from "./prefill-mapping";
import { detectMarketDocType } from "@/lib/market-doc-type";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Mêmes contrôles que /api/analysis
  if (!PERMISSIONS.analysis.run(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const docType = detectMarketDocType(file.name);

  // Extraction : un échec TECHNIQUE (module, PDF corrompu…) doit remonter en 500
  // explicite, à ne pas confondre avec un PDF scanné (texte réellement absent).
  let extractedText: string;
  try {
    extractedText = await extractFileText(file);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "erreur inconnue";
    return NextResponse.json(
      { error: `Échec technique de l'extraction : ${msg}` },
      { status: 500 }
    );
  }

  // PDF réellement sans texte (scanné) : on prévient l'UI sans lancer l'analyse.
  if (!extractedText || extractedText.trim().length === 0) {
    return NextResponse.json({ extractedChars: 0, docType, prefill: null });
  }

  try {
    const result = await analyzeContract(extractedText);
    return NextResponse.json({
      extractedChars: extractedText.length,
      docType,
      prefill: mapAnalysisToPrefill(result),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur lors de la pré-analyse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
