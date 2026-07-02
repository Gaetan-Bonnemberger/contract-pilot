/**
 * prefill-mapping.ts — Mapping résultat d'analyse → champs du formulaire de marché.
 *
 * Séparé de route.ts car Next 16 interdit à un route.ts d'exporter autre chose
 * que les handlers HTTP (POST, GET…).
 */
import type { AnalysisResult } from "@/lib/llm";

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
