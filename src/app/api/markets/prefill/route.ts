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
import { analyzeContract, type AnalysisResult } from "@/lib/llm";
import { extractFileText } from "@/lib/pdf";

export interface MarketPrefill {
  marketCode: string;
  clientName: string;
  title: string;
  lotName: string;
  marketType: string;
  firmAmountHt: number | null;
  optionAmountHt: number | null;
  renewalCount: number | null;
}

/** Mappe le résultat d'analyse vers les champs du formulaire de création. */
export function mapAnalysisToPrefill(result: AnalysisResult): MarketPrefill {
  const id = result.marketIdentification ?? {};
  const fin = result.financialSummary ?? {};
  return {
    marketCode: id.marketCode ?? "",
    clientName: id.clientName ?? "",
    title: id.title ?? "",
    lotName: id.lotName ?? "",
    marketType: id.marketType ?? "",
    firmAmountHt: fin.firmAmountHt ?? null,
    optionAmountHt: fin.optionAmountHt ?? null,
    renewalCount: fin.renewalCount ?? null,
  };
}

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

  const extractedText = await extractFileText(file);

  // PDF scanné / texte non extractible : on prévient l'UI sans lancer l'analyse.
  if (!extractedText || extractedText.trim().length === 0) {
    return NextResponse.json({ extractedChars: 0, prefill: null });
  }

  try {
    const result = await analyzeContract(extractedText);
    return NextResponse.json({
      extractedChars: extractedText.length,
      prefill: mapAnalysisToPrefill(result),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur lors de la pré-analyse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
