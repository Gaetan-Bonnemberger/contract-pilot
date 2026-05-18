/**
 * llm.ts — Service d'analyse IA des marchés contractuels
 *
 * Fonctionnement :
 *   1. Le responsable upload le PDF du marché via drag & drop (onglet "Analyse IA")
 *   2. Le serveur extrait le texte du document
 *   3. Ce service envoie le texte à Claude (Anthropic) et reçoit une analyse structurée
 *   4. L'analyse est ensuite validée manuellement avant d'être appliquée au marché
 *
 * Sans clé API (ANTHROPIC_API_KEY) : retourne un résultat de démonstration réaliste.
 * Avec clé API : analyse réelle du document fourni.
 */

export interface AnalysisResult {
  executiveSummary: string;
  criticalClauses: string;
  majorRisks: string;
  financialMechanisms: string;
  clarificationsNeeded: string;
  extractedClauses: Array<{
    articleRef: string;
    title: string;
    description: string;
    criticality: "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE";
    requiresFollowUp: boolean;
  }>;
  extractedKpis: Array<{
    kpiCode: string;
    name: string;
    category: string;
    kpiType: string;
    unit: string;
    frequency: string;
    greenThreshold?: number;
    orangeThreshold?: number;
    redThreshold?: number;
  }>;
  extractedObligations: Array<{
    title: string;
    description: string;
    category: string;
    criticality: "FAIBLE" | "MOYEN" | "FORT" | "CRITIQUE";
    frequency?: string;
    triggerCondition?: string;
    expectedEvidence?: string;
    dueRule?: string;
  }>;
}

const MOCK_RESULT: AnalysisResult = {
  executiveSummary:
    "Marché-cadre de travaux TPE avec Enedis sur la zone Aude Ouest. Montant ferme 220 000 € HT avec option 110 000 € HT. Durée 4 ans. Mécanisme de pénalités contractuelles significatif sur les délais d'intervention urgence et la conformité documentaire. Seuils de qualité (16/20) et sécurité (16/20) imposés avec revue périodique.",
  criticalClauses:
    "Article 34.6 — Pénalité de 500 € par intervention urgente hors délai contractuel. Article 34.6 — Pénalité de 4% de la valeur de la commande si topo photogrammétrique non remis. Article 34.7 — Pénalité pour touret non récupéré après AAT + 75 jours. Article 23.4 — Bonus pour remontée de situation dangereuse.",
  majorRisks:
    "Risque délais urgences (capacité astreinte). Risque documentaire (AAT, PAT, topo). Risque sécurité (note < 16 déclenchant revue contradictoire). Risque consommation (seuil 60% an 1, 80% suivants).",
  financialMechanisms:
    "Pénalités automatiques contractuelles sur délais et documents. Bonus discétionnaire sur sécurité. Intéressement sur délais de réception. Révision de prix annuelle selon index BT.",
  clarificationsNeeded:
    "Confirmer le périmètre géographique exact. Valider la liste des documents obligatoires par type de chantier. Confirmer le délai contractuel exact pour interventions urgentes.",
  extractedClauses: [
    {
      articleRef: "34.6",
      title: "Pénalité non-respect délai intervention urgence",
      description: "500 € par intervention urgente réalisée hors délai contractuel",
      criticality: "CRITIQUE",
      requiresFollowUp: true,
    },
    {
      articleRef: "34.6",
      title: "Pénalité topo photogrammétrique non remis",
      description: "4% de la valeur de la commande si topo requis non livré",
      criticality: "CRITIQUE",
      requiresFollowUp: true,
    },
    {
      articleRef: "34.7",
      title: "Pénalité touret non récupéré",
      description: "Pénalité si touret non récupéré après AAT + 75 jours",
      criticality: "FORT",
      requiresFollowUp: true,
    },
    {
      articleRef: "23.4",
      title: "Bonus situation dangereuse remontée",
      description: "100 € par situation dangereuse remontée",
      criticality: "MOYEN",
      requiresFollowUp: false,
    },
  ],
  extractedKpis: [
    {
      kpiCode: "KPI_URG_001",
      name: "Taux de respect des urgences",
      category: "Délais",
      kpiType: "Contractuel",
      unit: "%",
      frequency: "Hebdo",
      greenThreshold: 100,
      orangeThreshold: 95,
      redThreshold: 90,
    },
    {
      kpiCode: "KPI_DOC_001",
      name: "Taux de remise des topographies",
      category: "Conformité",
      kpiType: "Contractuel",
      unit: "%",
      frequency: "Mensuel",
      greenThreshold: 100,
      orangeThreshold: 95,
      redThreshold: 90,
    },
    {
      kpiCode: "KPI_SEC_001",
      name: "Note de sécurité",
      category: "Sécurité",
      kpiType: "Contractuel",
      unit: "/20",
      frequency: "Trimestriel",
      greenThreshold: 18,
      orangeThreshold: 16,
      redThreshold: 14,
    },
    {
      kpiCode: "KPI_QUAL_001",
      name: "Note de qualité",
      category: "Qualité",
      kpiType: "Contractuel",
      unit: "/20",
      frequency: "Trimestriel",
      greenThreshold: 18,
      orangeThreshold: 16,
      redThreshold: 14,
    },
  ],
  extractedObligations: [
    {
      title: "Respecter les délais d'intervention urgence",
      description: "Toute intervention urgente doit être réalisée dans le délai contractuel",
      category: "Délais",
      criticality: "CRITIQUE",
      frequency: "Chaque intervention urgente",
      triggerCondition: "Commande urgente reçue",
      expectedEvidence: "Horodatage ordre + réalisation",
      dueRule: "Immédiat selon délai contractuel",
    },
    {
      title: "Remettre le topo photogrammétrique",
      description: "Le topo doit être livré quand commandé par Enedis",
      category: "Documents",
      criticality: "CRITIQUE",
      frequency: "Chaque chantier concerné",
      triggerCondition: "Topo requis sur la commande",
      expectedEvidence: "Fichier topo validé transmis",
      dueRule: "Sous 2 jours après réalisation",
    },
    {
      title: "Récupérer les tourets dans les délais",
      description: "Demande de récupération de touret sous 75 jours après AAT",
      category: "Logistique",
      criticality: "FORT",
      frequency: "Chaque chantier avec touret",
      triggerCondition: "AAT signée + touret en place",
      expectedEvidence: "Bon de reprise touret",
      dueRule: "Sous 75 jours après AAT",
    },
  ],
};

export async function analyzeContract(
  text: string,
  marketContext?: string
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Mode mock — retourne un résultat réaliste après un délai simulé
    await new Promise((r) => setTimeout(r, 2000));
    return MOCK_RESULT;
  }

  const prompt = `Tu es un expert juridique spécialisé dans les marchés publics de travaux et maintenance réseaux.

Analyse le contrat suivant et extrais les informations structurées demandées.
${marketContext ? `Contexte du marché : ${marketContext}` : ""}

CONTRAT :
${text.substring(0, 100000)}

Réponds UNIQUEMENT en JSON valide avec la structure suivante :
{
  "executiveSummary": "string",
  "criticalClauses": "string",
  "majorRisks": "string",
  "financialMechanisms": "string",
  "clarificationsNeeded": "string",
  "extractedClauses": [
    {
      "articleRef": "string",
      "title": "string",
      "description": "string",
      "criticality": "FAIBLE|MOYEN|FORT|CRITIQUE",
      "requiresFollowUp": boolean
    }
  ],
  "extractedKpis": [
    {
      "kpiCode": "string",
      "name": "string",
      "category": "string",
      "kpiType": "Contractuel|Interne",
      "unit": "string",
      "frequency": "string",
      "greenThreshold": number|null,
      "orangeThreshold": number|null,
      "redThreshold": number|null
    }
  ],
  "extractedObligations": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "criticality": "FAIBLE|MOYEN|FORT|CRITIQUE",
      "frequency": "string|null",
      "triggerCondition": "string|null",
      "expectedEvidence": "string|null",
      "dueRule": "string|null"
    }
  ]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur API Claude: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  try {
    return JSON.parse(content) as AnalysisResult;
  } catch {
    throw new Error("Réponse IA invalide — impossible de parser le JSON");
  }
}
