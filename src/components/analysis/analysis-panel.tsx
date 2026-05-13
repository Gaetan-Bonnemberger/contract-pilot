"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AnalysisPanelProps {
  market: {
    id: string;
    marketCode: string;
    summary: {
      executiveSummary: string | null;
      criticalClauses: string | null;
      majorRisks: string | null;
      financialMechanisms: string | null;
      clarificationsNeeded: string | null;
      validatedAt: Date | null;
      validatedBy: { firstName: string; lastName: string } | null;
      analysisRun: { status: string; completedAt: Date | null } | null;
    } | null;
    clauses: Array<{ id: string; title: string; criticality: string; articleRef: string | null }>;
    kpis: Array<{ id: string; name: string; kpiCode: string; unit: string | null }>;
    obligations: Array<{ id: string; title: string; criticality: string }>;
  };
  canRun: boolean;
  canValidate: boolean;
}

export function AnalysisPanel({ market, canRun, canValidate }: AnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  const summary = market.summary;

  async function handleRunAnalysis() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("marketId", market.id);
      if (file) formData.append("file", file);

      const res = await fetch("/api/analysis", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success("Analyse terminée — vérifiez et validez les données extraites");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erreur lors de l'analyse");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const res = await fetch(`/api/markets/${market.id}/analysis/validate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analyse validée — les données sont maintenant officielles");
        router.refresh();
      } else {
        toast.error("Erreur lors de la validation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Panneau upload + lancement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Analyse IA du contrat</span>
            {summary?.validatedAt ? (
              <Badge className="bg-green-100 text-green-800 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Validée le {format(summary.validatedAt, "dd/MM/yyyy", { locale: fr })}
              </Badge>
            ) : summary ? (
              <Badge className="bg-orange-100 text-orange-800 border-0">
                <AlertCircle className="h-3 w-3 mr-1" />
                En attente de validation
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {canRun && (
              <>
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-sm">
                  <Upload className="h-4 w-4 text-gray-500" />
                  {file ? file.name : "Choisir un fichier PDF"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <Button
                  onClick={handleRunAnalysis}
                  disabled={loading}
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Analyse en cours..." : summary ? "Relancer l'analyse" : "Lancer l'analyse"}
                </Button>
              </>
            )}

            {canValidate && summary && !summary.validatedAt && (
              <Button
                onClick={handleValidate}
                disabled={validating}
                variant="outline"
                size="sm"
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {validating ? "Validation..." : "Valider l'analyse"}
              </Button>
            )}
          </div>
          {!canRun && !summary && (
            <p className="text-sm text-gray-400 mt-2">
              Vous n'avez pas les droits pour lancer une analyse. Contactez un responsable marché.
            </p>
          )}
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 gap-6">
          {/* Résumé exécutif */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Résumé exécutif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {summary.executiveSummary}
              </p>
            </CardContent>
          </Card>

          {/* Risques majeurs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risques majeurs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {summary.majorRisks}
              </p>
            </CardContent>
          </Card>

          {/* Clauses critiques extraites */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Clauses critiques ({market.clauses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {market.clauses.length === 0 && (
                <p className="text-sm text-gray-400">Aucune clause extraite. Validez l'analyse pour créer les clauses.</p>
              )}
              {market.clauses.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    {c.articleRef && <p className="text-xs text-gray-400">Art. {c.articleRef}</p>}
                  </div>
                  <Badge
                    className={`text-xs border-0 ${
                      c.criticality === "CRITIQUE"
                        ? "bg-red-100 text-red-800"
                        : c.criticality === "FORT"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {c.criticality}
                  </Badge>
                </div>
              ))}
              {summary.criticalClauses && market.clauses.length === 0 && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600 whitespace-pre-wrap">
                  {summary.criticalClauses}
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPIs extraits */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">KPI extraits ({market.kpis.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {market.kpis.length === 0 && (
                <p className="text-sm text-gray-400">Aucun KPI extrait. Validez l'analyse pour créer les KPI.</p>
              )}
              {market.kpis.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{k.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{k.kpiCode}</p>
                  </div>
                  <span className="text-xs text-gray-500">{k.unit}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Mécanismes financiers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mécanismes financiers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {summary.financialMechanisms}
              </p>
            </CardContent>
          </Card>

          {/* Points à clarifier */}
          {summary.clarificationsNeeded && (
            <Card className="border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-800">Points à clarifier</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-wrap">
                  {summary.clarificationsNeeded}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
