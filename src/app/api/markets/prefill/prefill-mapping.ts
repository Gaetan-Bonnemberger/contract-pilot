/**
 * prefill-mapping.ts — Mapping résultat d'analyse → champs du formulaire de marché.
 *
 * Séparé de route.ts car Next 16 interdit à un route.ts d'exporter autre chose
 * que les handlers HTTP (POST, GET…).
 */
import type { AnalysisResult } from "@/lib/llm";
import type { MarketDocType } from "@/lib/market-doc-type";

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

/** Résultat d'analyse d'UNE pièce : son type + le prefill (null si scanné/échec). */
export interface PrefillResult {
  docType: MarketDocType;
  prefill: MarketPrefill | null;
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

// ── Fusion multi-documents ──────────────────────────────────────────────────

type StringField = "marketCode" | "clientName" | "title" | "lotName" | "marketType";
type NumberField = "firmAmountHt" | "optionAmountHt" | "renewalCount";

// Priorité PAR CHAMP (index 0 = plus prioritaire).
const IDENT_PRIORITY:   MarketDocType[] = ["ccap", "ae", "rc", "dqe", "bpu", "cctp", "unknown"];
const AMOUNT_PRIORITY:  MarketDocType[] = ["dqe", "bpu", "ae", "ccap", "rc", "cctp", "unknown"];
const RENEWAL_PRIORITY: MarketDocType[] = ["ccap", "ae", "rc", "dqe", "bpu", "cctp", "unknown"];

function pickString(results: PrefillResult[], priority: MarketDocType[], field: StringField): string {
  for (const dt of priority)
    for (const r of results)
      if (r.docType === dt && r.prefill && r.prefill[field] !== "") return r.prefill[field];
  return "";
}

function pickNumber(results: PrefillResult[], priority: MarketDocType[], field: NumberField): number | null {
  for (const dt of priority)
    for (const r of results)
      if (r.docType === dt && r.prefill && r.prefill[field] !== null) return r.prefill[field];
  return null;
}

/**
 * Fusionne plusieurs prefills : pour chaque champ, prend la valeur non-vide du
 * document de plus haute priorité. N'écrase jamais une valeur non-vide par une vide.
 */
export function mergePrefills(results: PrefillResult[]): MarketPrefill {
  return {
    marketCode:     pickString(results, IDENT_PRIORITY, "marketCode"),
    clientName:     pickString(results, IDENT_PRIORITY, "clientName"),
    title:          pickString(results, IDENT_PRIORITY, "title"),
    lotName:        pickString(results, IDENT_PRIORITY, "lotName"),
    marketType:     pickString(results, IDENT_PRIORITY, "marketType"),
    firmAmountHt:   pickNumber(results, AMOUNT_PRIORITY, "firmAmountHt"),
    optionAmountHt: pickNumber(results, AMOUNT_PRIORITY, "optionAmountHt"),
    renewalCount:   pickNumber(results, RENEWAL_PRIORITY, "renewalCount"),
  };
}
