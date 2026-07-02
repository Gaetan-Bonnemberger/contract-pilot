"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AnalysisResult } from "@/lib/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisPanelProps {
  market: {
    id: string;
    marketCode: string | null;
    summary: {
      executiveSummary: string | null;
      criticalClauses: string | null;
      majorRisks: string | null;
      financialMechanisms: string | null;
      clarificationsNeeded: string | null;
      validatedAt: Date | null;
      validatedBy: { firstName: string; lastName: string } | null;
      analysisRun: { status: string; completedAt: Date | null; llmRawResponse?: unknown } | null;
    } | null;
    clauses: Array<{ id: string; title: string; criticality: string; articleRef: string | null }>;
    kpis: Array<{ id: string; name: string; kpiCode: string; unit: string | null }>;
    obligations: Array<{ id: string; title: string; criticality: string }>;
  };
  canRun: boolean;
  canValidate: boolean;
}

// ── Helpers visuels ───────────────────────────────────────────────────────────

const CRITICALITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-800",
  FORT:     "bg-orange-100 text-orange-800",
  MOYEN:    "bg-yellow-100 text-yellow-700",
  FAIBLE:   "bg-gray-100 text-gray-600",
};

type Step = "idle" | "upload" | "extract" | "analyze" | "done" | "error";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload",  label: "Envoi du fichier" },
  { key: "extract", label: "Extraction du texte" },
  { key: "analyze", label: "Analyse IA" },
  { key: "done",    label: "Terminé" },
];

function StepIndicator({ current }: { current: Step }) {
  const stepKeys: Step[] = ["upload", "extract", "analyze", "done"];
  const currentIndex = stepKeys.indexOf(current);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        const waiting = currentIndex < i;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done    ? "bg-green-500 text-white" :
                active  ? "bg-blue-600 text-white animate-pulse" :
                          "bg-gray-200 text-gray-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span className={`text-xs ${active ? "text-blue-700 font-medium" : waiting ? "text-gray-400" : "text-green-700"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px ${done ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Zone drag & drop ──────────────────────────────────────────────────────────

function DropZone({
  file,
  onFileChange,
  disabled,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [disabled, onFileChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
        disabled
          ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
          : dragging
          ? "border-blue-400 bg-blue-50"
          : file
          ? "border-green-400 bg-green-50"
          : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="space-y-2">
          <div className="text-3xl">📄</div>
          <p className="text-sm font-medium text-green-800">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko</p>
          {!disabled && (
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
            >
              Retirer le fichier
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-3xl text-gray-300">📁</div>
          <p className="text-sm font-medium text-gray-600">
            Glissez-déposez un fichier PDF ici
          </p>
          <p className="text-xs text-gray-400">ou cliquez pour sélectionner</p>
          <p className="text-xs text-gray-400">PDF, TXT — max 50 Mo</p>
        </div>
      )}
    </div>
  );
}

// ── Onglets de prévisualisation ───────────────────────────────────────────────

type PreviewTab = "resume" | "clauses" | "kpis" | "obligations" | "penalites" | "finances";

const PREVIEW_TABS: { key: PreviewTab; label: string }[] = [
  { key: "resume",      label: "Résumé" },
  { key: "clauses",     label: "Clauses" },
  { key: "kpis",        label: "KPI" },
  { key: "obligations", label: "Obligations" },
  { key: "penalites",   label: "Pénalités / Bonus" },
  { key: "finances",    label: "Finances" },
];

function AnalysisPreview({ result }: { result: AnalysisResult }) {
  const [tab, setTab] = useState<PreviewTab>("resume");

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {PREVIEW_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-700 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {t.key === "clauses" && result.extractedClauses.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {result.extractedClauses.length}
              </span>
            )}
            {t.key === "kpis" && result.extractedKpis.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {result.extractedKpis.length}
              </span>
            )}
            {t.key === "obligations" && result.extractedObligations.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {result.extractedObligations.length}
              </span>
            )}
            {t.key === "penalites" && (
              <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                {(result.extractedPenalties?.length ?? 0) + (result.extractedBonuses?.length ?? 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === "resume" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-1.5">Résumé exécutif</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.executiveSummary}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-semibold text-red-800 mb-1.5">Risques majeurs</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.majorRisks}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Mécanismes financiers</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.financialMechanisms}</p>
            </div>
            {result.clarificationsNeeded && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs font-semibold text-orange-800 mb-1.5">Points à clarifier</p>
                <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-wrap">{result.clarificationsNeeded}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "clauses" && (
        <div className="space-y-2">
          {result.extractedClauses.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Aucune clause extraite</p>
          )}
          {result.extractedClauses.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex-shrink-0">
                {c.articleRef || "—"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.description}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CRITICALITY_COLORS[c.criticality]}`}>
                  {c.criticality}
                </span>
                {c.requiresFollowUp && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">suivi</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "kpis" && (
        <div className="overflow-x-auto">
          {result.extractedKpis.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Aucun KPI extrait</p>
          )}
          {result.extractedKpis.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Nom", "Catégorie", "Unité", "Fréquence", "🟢 Vert", "🟠 Orange", "🔴 Rouge"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.extractedKpis.map((k, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 text-xs">{k.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{k.kpiCode}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{k.category}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{k.unit}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{k.frequency}</td>
                    <td className="px-3 py-2 text-xs text-green-700 font-medium">{k.greenThreshold ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-orange-600 font-medium">{k.orangeThreshold ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-red-600 font-medium">{k.redThreshold ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "obligations" && (
        <div className="space-y-2">
          {result.extractedObligations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Aucune obligation extraite</p>
          )}
          {result.extractedObligations.map((o, i) => (
            <div key={i} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{o.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${CRITICALITY_COLORS[o.criticality]}`}>
                  {o.criticality}
                </span>
              </div>
              <p className="text-xs text-gray-600">{o.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                {o.frequency && <span><strong>Fréquence :</strong> {o.frequency}</span>}
                {o.triggerCondition && <span><strong>Déclencheur :</strong> {o.triggerCondition}</span>}
                {o.expectedEvidence && <span><strong>Preuve :</strong> {o.expectedEvidence}</span>}
                {o.dueRule && <span><strong>Délai :</strong> {o.dueRule}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "penalites" && (
        <div className="space-y-4">
          {/* Pénalités */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Pénalités ({result.extractedPenalties?.length ?? 0})
            </h4>
            {(!result.extractedPenalties || result.extractedPenalties.length === 0) ? (
              <p className="text-sm text-gray-400 py-2">Aucune pénalité identifiée</p>
            ) : (
              <div className="space-y-2">
                {result.extractedPenalties.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded mr-2">
                          Art. {p.articleRef}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{p.description}</span>
                      </div>
                    </div>
                    <p className="text-xs text-red-700 font-semibold mt-1.5">💸 {p.formula}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Déclencheur : {p.trigger}</p>
                    {p.maxAmount && <p className="text-xs text-gray-500 mt-0.5">Plafond : {p.maxAmount}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bonus */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Bonus ({result.extractedBonuses?.length ?? 0})
            </h4>
            {(!result.extractedBonuses || result.extractedBonuses.length === 0) ? (
              <p className="text-sm text-gray-400 py-2">Aucun bonus identifié</p>
            ) : (
              <div className="space-y-2">
                {result.extractedBonuses.map((b, i) => (
                  <div key={i} className="p-3 rounded-lg bg-green-50 border border-green-100">
                    <span className="font-mono text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded mr-2">
                      Art. {b.articleRef}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{b.description}</span>
                    <p className="text-xs text-green-700 font-semibold mt-1.5">🎯 {b.formula}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Condition : {b.condition}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "finances" && (
        <div className="grid grid-cols-2 gap-4">
          {result.financialSummary ? (
            <>
              {[
                { label: "Montant ferme HT",   value: result.financialSummary.firmAmountHt   ? `${Number(result.financialSummary.firmAmountHt).toLocaleString("fr-FR")} €` : null },
                { label: "Options HT",          value: result.financialSummary.optionAmountHt ? `${Number(result.financialSummary.optionAmountHt).toLocaleString("fr-FR")} €` : null },
                { label: "Durée",               value: result.financialSummary.contractDurationMonths ? `${result.financialSummary.contractDurationMonths} mois` : null },
                { label: "Reconductions",       value: result.financialSummary.renewalCount !== undefined ? `${result.financialSummary.renewalCount} fois` : null },
                { label: "Révision de prix",    value: result.financialSummary.priceRevisionIndex ?? null },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ) : null
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 col-span-2 text-center py-6">
              Aucune donnée financière extraite
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panneau principal ─────────────────────────────────────────────────────────

export function AnalysisPanel({ market, canRun, canValidate }: AnalysisPanelProps) {
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [extractedChars, setExtractedChars] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const router = useRouter();

  const summary = market.summary;
  const isRunning = step !== "idle" && step !== "done" && step !== "error";

  // Récupérer le résultat depuis la DB si déjà analysé
  const savedResult = summary?.analysisRun?.llmRawResponse as AnalysisResult | null;
  const shownResult = analysisResult ?? savedResult;

  async function handleRunAnalysis() {
    setStep("upload");
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("marketId", market.id);
      if (file) formData.append("file", file);

      setStep("extract");

      const res = await fetch("/api/analysis", {
        method: "POST",
        body: formData,
      });

      setStep("analyze");

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erreur lors de l'analyse");
      }

      setAnalysisResult(data.result);
      setExtractedChars(data.extractedChars ?? null);
      setStep("done");
      toast.success(
        `Analyse terminée — ${data.result.extractedClauses?.length ?? 0} clauses, ${data.result.extractedKpis?.length ?? 0} KPI, ${data.result.extractedObligations?.length ?? 0} obligations extraits`
      );
      router.refresh();
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const res = await fetch(`/api/markets/${market.id}/analysis/validate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analyse validée — clauses, KPI et obligations créés dans le marché");
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Erreur lors de la validation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Zone de lancement ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Analyse IA du contrat</CardTitle>
            {summary?.validatedAt ? (
              <Badge className="bg-green-100 text-green-800 border-0 text-xs">
                ✓ Validée le {format(new Date(summary.validatedAt), "d MMM yyyy", { locale: fr })}
                {summary.validatedBy && ` par ${summary.validatedBy.firstName} ${summary.validatedBy.lastName}`}
              </Badge>
            ) : shownResult ? (
              <Badge className="bg-orange-100 text-orange-800 border-0 text-xs">
                ⏳ En attente de validation
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canRun && !shownResult && (
            <p className="text-sm text-gray-400">
              Vous n'avez pas les droits pour lancer une analyse. Contactez un responsable marché.
            </p>
          )}

          {canRun && (
            <>
              <DropZone file={file} onFileChange={setFile} disabled={isRunning} />

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={handleRunAnalysis}
                  disabled={isRunning}
                  size="sm"
                >
                  {isRunning ? "Analyse en cours…" : shownResult ? "Relancer l'analyse" : "Lancer l'analyse IA"}
                </Button>

                {canValidate && shownResult && !summary?.validatedAt && (
                  <Button
                    onClick={handleValidate}
                    disabled={validating || isRunning}
                    variant="outline"
                    size="sm"
                    className="border-green-500 text-green-700 hover:bg-green-50"
                  >
                    {validating ? "Validation…" : "✓ Valider et importer les données"}
                  </Button>
                )}
              </div>

              {isRunning && (
                <div className="pt-2">
                  <StepIndicator current={step} />
                  <p className="text-xs text-gray-400 mt-2">
                    {step === "upload"  && "Envoi du fichier en cours…"}
                    {step === "extract" && "Extraction du texte depuis le PDF…"}
                    {step === "analyze" && "Claude analyse le contrat… (peut prendre 30–60 s)"}
                  </p>
                </div>
              )}

              {step === "error" && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
                  L'analyse a échoué. Vérifiez que le fichier est un PDF valide et réessayez.
                </p>
              )}

              {step === "done" && extractedChars !== null && (
                <p className="text-xs text-gray-500">
                  ✅ {extractedChars.toLocaleString("fr-FR")} caractères extraits du document.
                  {extractedChars === 0 && " Le PDF est peut-être scanné (image) — essayez un PDF natif."}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Prévisualisation du résultat ───────────────────────────────────── */}
      {shownResult && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Résultats de l'analyse
                {!summary?.validatedAt && (
                  <span className="ml-2 text-xs font-normal text-orange-600">
                    — prévisualisation (non encore importé dans le marché)
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{shownResult.extractedClauses?.length ?? 0} clauses</span>
                <span>{shownResult.extractedKpis?.length ?? 0} KPI</span>
                <span>{shownResult.extractedObligations?.length ?? 0} obligations</span>
                <span>{(shownResult.extractedPenalties?.length ?? 0)} pénalités</span>
                <span>{(shownResult.extractedBonuses?.length ?? 0)} bonus</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnalysisPreview result={shownResult} />
          </CardContent>
        </Card>
      )}

      {/* ── Données importées (après validation) ──────────────────────────── */}
      {summary?.validatedAt && (market.clauses.length > 0 || market.kpis.length > 0) && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800">Données importées dans le marché</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Clauses ({market.clauses.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {market.clauses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{c.title}</p>
                        {c.articleRef && <p className="text-xs text-gray-400">Art. {c.articleRef}</p>}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${CRITICALITY_COLORS[c.criticality]}`}>
                        {c.criticality}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  KPI ({market.kpis.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {market.kpis.map((k) => (
                    <div key={k.id} className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-900 truncate">{k.name}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{k.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
