/**
 * llm-ollama.ts — Analyse IA des marchés via un LLM LOCAL (Ollama)
 *
 * Conformité RGPD : aucune donnée de marché ne sort de la machine.
 * L'extraction est fiabilisée par une sortie structurée contrainte par
 * schéma JSON (option `format` d'Ollama), dérivée du schéma zod ci-dessous.
 *
 * Le schéma `analysisResultSchema` reflète EXACTEMENT l'interface
 * AnalysisResult de llm.ts (mêmes champs obligatoires / optionnels).
 */
import { z } from "zod";
import { buildPrompt, type AnalysisResult } from "./llm";

// ── Schéma zod (miroir de AnalysisResult) ─────────────────────────────────────

const criticality = z.enum(["FAIBLE", "MOYEN", "FORT", "CRITIQUE"]);

const extractedClauseSchema = z.object({
  articleRef: z.string(),
  title: z.string(),
  description: z.string(),
  criticality,
  requiresFollowUp: z.boolean(),
});

const extractedKpiSchema = z.object({
  kpiCode: z.string(),
  name: z.string(),
  category: z.string(),
  kpiType: z.string(),
  unit: z.string(),
  frequency: z.string(),
  greenThreshold: z.number().nullable().optional(),
  orangeThreshold: z.number().nullable().optional(),
  redThreshold: z.number().nullable().optional(),
});

const extractedObligationSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  criticality,
  frequency: z.string().optional(),
  triggerCondition: z.string().optional(),
  expectedEvidence: z.string().optional(),
  dueRule: z.string().optional(),
});

const extractedPenaltySchema = z.object({
  articleRef: z.string(),
  description: z.string(),
  formula: z.string(),
  trigger: z.string(),
  maxAmount: z.string().optional(),
});

const extractedBonusSchema = z.object({
  articleRef: z.string(),
  description: z.string(),
  formula: z.string(),
  condition: z.string(),
});

const financialSummarySchema = z.object({
  firmAmountHt: z.number().nullable().optional(),
  optionAmountHt: z.number().nullable().optional(),
  contractDurationMonths: z.number().nullable().optional(),
  renewalCount: z.number().nullable().optional(),
  priceRevisionIndex: z.string().optional(),
});

const marketIdentificationSchema = z.object({
  marketCode: z.string().optional(),
  clientName: z.string().optional(),
  title: z.string().optional(),
  lotName: z.string().optional(),
  marketType: z.string().optional(),
});

export const analysisResultSchema = z.object({
  executiveSummary: z.string(),
  criticalClauses: z.string(),
  majorRisks: z.string(),
  financialMechanisms: z.string(),
  clarificationsNeeded: z.string(),
  extractedClauses: z.array(extractedClauseSchema),
  extractedKpis: z.array(extractedKpiSchema),
  extractedObligations: z.array(extractedObligationSchema),
  extractedPenalties: z.array(extractedPenaltySchema),
  extractedBonuses: z.array(extractedBonusSchema),
  financialSummary: financialSummarySchema,
  marketIdentification: marketIdentificationSchema,
});

// JSON Schema transmis à Ollama pour contraindre la génération (zod 4.4.3)
const analysisJsonSchema = z.toJSONSchema(analysisResultSchema);

// ── Appel du LLM local ────────────────────────────────────────────────────────

export async function analyzeContractOllama(
  text: string,
  marketContext = ""
): Promise<AnalysisResult> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "mistral:7b";
  const numCtx = Number(process.env.OLLAMA_NUM_CTX ?? 16384);
  const numPredict = Number(process.env.OLLAMA_NUM_PREDICT ?? 4096);

  // Aligner la troncature sur la fenêtre de contexte : num_ctx = entrée + sortie.
  // Sans ça, un CCAP volumineux déborde en silence et le modèle perd la fin.
  // Budget d'entrée (tokens) = num_ctx − num_predict − marge prompt (~900),
  // puis ≈ 3 caractères par token.
  const inputBudgetTokens = numCtx - numPredict - 900;
  const maxChars = Math.max(1000, inputBudgetTokens * 3);
  const prompt = buildPrompt(text, marketContext, maxChars);

  console.log(`[ollama] texte envoyé : ${prompt.length} caractères (num_ctx=${numCtx})`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: analysisJsonSchema,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: 0.1, num_ctx: numCtx, num_predict: numPredict },
      }),
    });
  } catch (err) {
    throw new Error(
      `Ollama injoignable sur ${baseUrl}. Lancez Ollama (\`ollama serve\`) puis ` +
      `installez le modèle (\`ollama pull ${model}\`). ` +
      `Détail : ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erreur Ollama (HTTP ${response.status}) : ${errorBody}`);
  }

  const data = await response.json();
  const content: string = data?.message?.content ?? "";
  if (!content) {
    throw new Error("Réponse d'Ollama vide (message.content manquant).");
  }

  // Parse direct, avec filet de secours : du premier '{' au dernier '}'.
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Réponse Ollama : JSON invalide (aucun objet exploitable).");
    }
    try {
      json = JSON.parse(content.slice(start, end + 1));
    } catch {
      throw new Error("Réponse Ollama : JSON invalide (échec du parse après extraction).");
    }
  }

  const result = analysisResultSchema.safeParse(json);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(racine)"}: ${i.message}`)
      .join(" ; ");
    throw new Error(`Réponse Ollama : structure non conforme au schéma attendu. ${details}`);
  }

  return result.data;
}
