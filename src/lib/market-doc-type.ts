/** Type de pièce d'un dossier de marché, déduit du nom de fichier. */
export type MarketDocType = "ccap" | "cctp" | "rc" | "ae" | "bpu" | "dqe" | "unknown";

/**
 * Vrai si `token` apparaît comme mot isolé dans `n`, avec une borne
 * NON-alphanumérique (début/fin, ou séparateur `_ - . espace…`).
 * On n'utilise pas `\b` car en JS `_` est un caractère de mot : `\bccap\b`
 * échouerait sur « ccap_marché ». Cette borne évite aussi les faux positifs
 * type « rc » dans « marché » ou « ae » dans « zae ».
 */
function hasToken(token: string, n: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(n);
}

/**
 * Détecte le type de document par correspondance (insensible à la casse) sur le
 * nom de fichier. Tokens courts (ae/rc) bornés pour éviter les faux positifs.
 */
export function detectMarketDocType(fileName: string): MarketDocType {
  const n = fileName.toLowerCase();
  if (hasToken("ccap", n)) return "ccap";
  if (hasToken("cctp", n)) return "cctp";
  if (hasToken("bpu", n)) return "bpu";
  if (hasToken("dqe", n) || hasToken("devis", n)) return "dqe";
  if (n.includes("acte d'engagement") || n.includes("acte d’engagement") || hasToken("ae", n)) return "ae";
  if (hasToken("rc", n)) return "rc";
  return "unknown";
}
