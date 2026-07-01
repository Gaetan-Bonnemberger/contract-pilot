/**
 * llm.ts — Service d'analyse IA des marchés contractuels
 *
 * Fonctionnement :
 *   1. Le responsable upload le PDF du marché via drag & drop (onglet "Analyse IA")
 *   2. Le serveur extrait le texte brut via pdf-parse (src/lib/pdf.ts)
 *   3. Ce service envoie le texte à Claude et reçoit une analyse structurée JSON
 *   4. L'analyse est prévisualisée puis validée manuellement avant application
 *
 * Fallback : sans clé ANTHROPIC_API_KEY, retourne un résultat de démonstration.
 * Modèle : claude-sonnet-4-5 (rapide, précis, économique vs Opus)
 *
 * Aiguillage LLM_PROVIDER : "ollama" (LLM local, RGPD), "anthropic" (cloud), "mock".
 */
import { analyzeContractOllama } from "./llm-ollama";

// ── Types exportés ────────────────────────────────────────────────────────────

export interface ExtractedClause {
  articleRef: string;
  title: string;
  description: string;
  criticality: "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE";
  requiresFollowUp: boolean;
}

export interface ExtractedKpi {
  kpiCode: string;
  name: string;
  category: string;
  kpiType: string;
  unit: string;
  frequency: string;
  greenThreshold?: number;
  orangeThreshold?: number;
  redThreshold?: number;
}

export interface ExtractedObligation {
  title: string;
  description: string;
  category: string;
  criticality: "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE";
  frequency?: string;
  triggerCondition?: string;
  expectedEvidence?: string;
  dueRule?: string;
}

export interface ExtractedPenalty {
  articleRef: string;
  description: string;
  formula: string;        // ex. "500 € par intervention hors délai"
  trigger: string;        // ex. "Intervention urgente hors délai"
  maxAmount?: string;     // ex. "5 000 € / mois"
}

export interface ExtractedBonus {
  articleRef: string;
  description: string;
  formula: string;
  condition: string;
}

export interface AnalysisResult {
  // Résumé narratif
  executiveSummary: string;
  criticalClauses: string;
  majorRisks: string;
  financialMechanisms: string;
  clarificationsNeeded: string;

  // Données structurées extraites
  extractedClauses: ExtractedClause[];
  extractedKpis: ExtractedKpi[];
  extractedObligations: ExtractedObligation[];
  extractedPenalties: ExtractedPenalty[];
  extractedBonuses: ExtractedBonus[];

  // Données financières de synthèse
  financialSummary: {
    firmAmountHt?: number;
    optionAmountHt?: number;
    contractDurationMonths?: number;
    renewalCount?: number;
    priceRevisionIndex?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extrait un objet JSON depuis une réponse Claude qui peut contenir
 * du texte ou des blocs de code markdown autour du JSON.
 */
function extractJson(text: string): unknown {
  // 1. Bloc ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
  }

  // 2. Premier { ... } de niveau racine (greedy)
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* continue */ }
  }

  // 3. Tenter directement (texte pur JSON)
  try { return JSON.parse(text.trim()); } catch { /* noop */ }

  throw new Error("Impossible d'extraire un JSON valide depuis la réponse IA");
}

// ── Données de démonstration ──────────────────────────────────────────────────

const MOCK_RESULT: AnalysisResult = {
  executiveSummary:
    "Marché-cadre de travaux TPE avec Enedis sur la zone Aude Ouest. Montant ferme 220 000 € HT avec option 110 000 € HT. Durée 4 ans reconductible. Mécanisme de pénalités contractuelles significatif sur les délais d'intervention urgence, la conformité documentaire (AAT, PAT, topo) et la récupération de tourets. Seuils de qualité (16/20) et sécurité (16/20) imposés avec revue contradictoire si non atteints. Révision annuelle de prix sur index BT.",
  criticalClauses:
    "Art. 34.6 — Pénalité 500 € / intervention urgente hors délai. Art. 34.6 — Pénalité 4% valeur commande si topo non remis. Art. 34.7 — Pénalité touret non récupéré après AAT+75j. Art. 23.4 — Bonus 100 € / situation dangereuse remontée.",
  majorRisks:
    "Risque délais urgences (capacité astreinte). Risque documentaire (AAT, PAT, topo). Risque sécurité (note < 16 déclenchant revue contradictoire). Risque consommation (seuil 60% an 1, 80% suivants).",
  financialMechanisms:
    "Pénalités automatiques sur délais et documents. Bonus discrétionnaire sécurité. Intéressement sur réception. Révision prix annuelle index BT. Décomptes mensuels.",
  clarificationsNeeded:
    "Confirmer le périmètre géographique exact et la liste des sites prioritaires. Valider la liste exhaustive des documents obligatoires par type de chantier. Confirmer le délai contractuel exact pour interventions urgentes (H24 ? H48 ?).",
  extractedClauses: [
    { articleRef: "34.6", title: "Pénalité retard intervention urgente", description: "500 € par intervention urgente réalisée hors délai contractuel", criticality: "CRITIQUE", requiresFollowUp: true },
    { articleRef: "34.6", title: "Pénalité topo non remis", description: "4% de la valeur de la commande si topo photogrammétrique requis non livré", criticality: "CRITIQUE", requiresFollowUp: true },
    { articleRef: "34.7", title: "Pénalité touret non récupéré", description: "Pénalité si touret non récupéré après AAT + 75 jours", criticality: "FORT", requiresFollowUp: true },
    { articleRef: "23.4", title: "Bonus situation dangereuse", description: "100 € par situation dangereuse identifiée et remontée", criticality: "MOYEN", requiresFollowUp: false },
  ],
  extractedKpis: [
    { kpiCode: "KPI_URG_001", name: "Taux de respect des urgences", category: "Délais", kpiType: "Contractuel", unit: "%", frequency: "Hebdo", greenThreshold: 100, orangeThreshold: 95, redThreshold: 90 },
    { kpiCode: "KPI_DOC_001", name: "Taux de remise des topographies", category: "Conformité", kpiType: "Contractuel", unit: "%", frequency: "Mensuel", greenThreshold: 100, orangeThreshold: 95, redThreshold: 90 },
    { kpiCode: "KPI_SEC_001", name: "Note de sécurité", category: "Sécurité", kpiType: "Contractuel", unit: "/20", frequency: "Trimestriel", greenThreshold: 18, orangeThreshold: 16, redThreshold: 14 },
    { kpiCode: "KPI_QUAL_001", name: "Note de qualité", category: "Qualité", kpiType: "Contractuel", unit: "/20", frequency: "Trimestriel", greenThreshold: 18, orangeThreshold: 16, redThreshold: 14 },
  ],
  extractedObligations: [
    { title: "Respecter les délais d'intervention urgence", description: "Toute intervention urgente doit être réalisée dans le délai contractuel sous peine de pénalité", category: "Délais", criticality: "CRITIQUE", frequency: "Chaque intervention urgente", triggerCondition: "Commande urgente reçue", expectedEvidence: "Horodatage ordre + réalisation", dueRule: "Immédiat selon délai contractuel" },
    { title: "Remettre le topo photogrammétrique", description: "Le topo doit être livré dans les délais quand commandé par le maître d'ouvrage", category: "Documents", criticality: "CRITIQUE", frequency: "Chaque chantier concerné", triggerCondition: "Topo requis sur la commande", expectedEvidence: "Fichier topo validé transmis", dueRule: "Sous 2 jours après réalisation" },
    { title: "Récupérer les tourets dans les délais", description: "Demande de récupération de touret dans les 75 jours après AAT", category: "Logistique", criticality: "FORT", frequency: "Chaque chantier avec touret", triggerCondition: "AAT signée + touret en place", expectedEvidence: "Bon de reprise touret", dueRule: "Sous 75 jours après AAT" },
  ],
  extractedPenalties: [
    { articleRef: "34.6", description: "Pénalité intervention urgente hors délai", formula: "500 € par intervention", trigger: "Intervention urgente réalisée hors délai contractuel" },
    { articleRef: "34.6", description: "Pénalité topo non remis", formula: "4% de la valeur de la commande", trigger: "Topo photogrammétrique commandé et non livré" },
    { articleRef: "34.7", description: "Pénalité touret non récupéré", formula: "Montant forfaitaire", trigger: "Touret non récupéré après AAT + 75 jours" },
  ],
  extractedBonuses: [
    { articleRef: "23.4", description: "Bonus remontée situation dangereuse", formula: "100 € par situation", condition: "Situation dangereuse identifiée et signalée au maître d'ouvrage" },
  ],
  financialSummary: {
    firmAmountHt: 220000,
    optionAmountHt: 110000,
    contractDurationMonths: 48,
    renewalCount: 0,
    priceRevisionIndex: "Index BT annuel",
  },
};

// ── Prompt principal ──────────────────────────────────────────────────────────

export function buildPrompt(text: string, marketContext: string, maxChars = 120000): string {
  // Tronquer pour respecter la fenêtre de contexte du modèle
  const truncated = text.length > maxChars
    ? text.substring(0, maxChars) + `\n\n[... document tronqué à ${maxChars} caractères pour respecter les limites ...]`
    : text;

  return `Tu es un expert juridique et technique spécialisé dans les marchés publics de travaux (BTP, réseaux, maintenance). Tu maîtrises parfaitement le droit de la commande publique français, les CCAP/CCTP, et les mécanismes de pénalités/bonus contractuels.

${marketContext ? `CONTEXTE DU MARCHÉ : ${marketContext}\n` : ""}

Analyse le document contractuel ci-dessous et extrais toutes les informations utiles pour la gestion opérationnelle du marché.

INSTRUCTIONS :
- Sois exhaustif sur les clauses à risque financier (pénalités, délais, seuils)
- Extrais TOUS les KPI mesurables mentionnés (taux, notes, délais chiffrés)
- Identifie toutes les obligations avec leurs preuves attendues
- Note les références d'articles précises (ex: "Art. 34.6", "§ 3.2", "Article 12")
- Pour les montants : convertis toujours en nombre (ex: "2 500" et non "2 500 €")
- Si une information est absente du document, omets le champ (ne pas inventer)
- Réponds UNIQUEMENT en JSON valide, sans texte avant ni après

DOCUMENT :
${truncated}

Réponds avec ce JSON exact (respecte strictement les types) :
{
  "executiveSummary": "Résumé exécutif en 3-5 phrases : objet, montants, durée, points clés",
  "criticalClauses": "Liste des clauses à fort impact financier ou risque opérationnel, avec références d'articles",
  "majorRisks": "Risques opérationnels et financiers identifiés, classés par criticité",
  "financialMechanisms": "Mécanismes financiers : révision prix, décomptes, intéressement, pénalités automatiques vs discrétionnaires",
  "clarificationsNeeded": "Points ambigus ou à clarifier avec le maître d'ouvrage",
  "extractedClauses": [
    {
      "articleRef": "ex: 34.6",
      "title": "Titre court de la clause",
      "description": "Description détaillée : montant, formule, conditions de déclenchement",
      "criticality": "CRITIQUE|FORT|MOYEN|FAIBLE",
      "requiresFollowUp": true
    }
  ],
  "extractedKpis": [
    {
      "kpiCode": "KPI_XXX_001",
      "name": "Nom du KPI",
      "category": "Délais|Sécurité|Qualité|Conformité|Environnement|Financier",
      "kpiType": "Contractuel|Interne",
      "unit": "% ou /20 ou jours ou €...",
      "frequency": "Quotidien|Hebdo|Mensuel|Trimestriel|Annuel|Par chantier",
      "greenThreshold": 100,
      "orangeThreshold": 95,
      "redThreshold": 90
    }
  ],
  "extractedObligations": [
    {
      "title": "Titre court",
      "description": "Description de l'obligation et conséquences si non respectée",
      "category": "Délais|Documents|Sécurité|Qualité|Logistique|Reporting|Conformité|Autre",
      "criticality": "CRITIQUE|FORT|MOYEN|FAIBLE",
      "frequency": "ex: Chaque intervention urgente",
      "triggerCondition": "ex: Commande reçue",
      "expectedEvidence": "ex: Horodatage signé",
      "dueRule": "ex: Sous 48h après réception commande"
    }
  ],
  "extractedPenalties": [
    {
      "articleRef": "ex: 34.6",
      "description": "Description courte",
      "formula": "ex: 500 € par intervention hors délai",
      "trigger": "Condition de déclenchement",
      "maxAmount": "ex: plafonné à 5% du montant mensuel (optionnel)"
    }
  ],
  "extractedBonuses": [
    {
      "articleRef": "ex: 23.4",
      "description": "Description courte",
      "formula": "ex: 100 € par situation remontée",
      "condition": "Condition d'obtention"
    }
  ],
  "financialSummary": {
    "firmAmountHt": 220000,
    "optionAmountHt": 110000,
    "contractDurationMonths": 48,
    "renewalCount": 0,
    "priceRevisionIndex": "ex: Index BT annuel"
  }
}`;
}

// ── Fonction principale ───────────────────────────────────────────────────────

export async function analyzeContract(
  text: string,
  marketContext = ""
): Promise<AnalysisResult> {
  const provider = (
    process.env.LLM_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock")
  ).toLowerCase();

  if (provider === "ollama") {
    return analyzeContractOllama(text, marketContext);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (provider === "mock" || !apiKey) {
    // Mode démonstration — simule un délai réaliste
    await new Promise((r) => setTimeout(r, 1500));
    return MOCK_RESULT;
  }

  // ── Chemin Anthropic existant, INCHANGÉ ──────────────────────────────────
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const prompt = buildPrompt(text, marketContext);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.1, // Faible température pour des extractions cohérentes
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erreur API Claude (${response.status}) : ${errorBody}`);
  }

  const data = await response.json();
  const rawText: string = data.content?.[0]?.text ?? "";

  if (!rawText) {
    throw new Error("La réponse de Claude est vide");
  }

  const parsed = extractJson(rawText) as AnalysisResult;

  // Validation minimale des champs obligatoires
  if (!parsed.executiveSummary || !Array.isArray(parsed.extractedClauses)) {
    throw new Error("Structure JSON incomplète dans la réponse IA");
  }

  // S'assurer que les tableaux optionnels existent
  parsed.extractedPenalties ??= [];
  parsed.extractedBonuses ??= [];
  parsed.financialSummary ??= {};

  return parsed;
}
