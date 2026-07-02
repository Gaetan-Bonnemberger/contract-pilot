/** Libellé lisible du code marché, désormais facultatif. */
export const NO_MARKET_CODE = "— (code non attribué)";

export function marketCodeLabel(code: string | null | undefined): string {
  return code && code.trim() ? code : NO_MARKET_CODE;
}
