"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  marketId: string;
  currentWeights: Record<string, number>;
  defaultWeights: Record<string, number>;
  metricLabels: Record<string, string>;
  isCustom: Record<string, boolean>;
  hasCustom: boolean;
  canEdit: boolean;
}

const METRIC_ORDER = ["DELAIS", "SECURITE", "QUALITE", "DOCUMENTS", "RECEPTION", "PENALITES", "ALERTES", "BONUS"];

const METRIC_DESCRIPTIONS: Record<string, string> = {
  DELAIS:    "Taux d'urgences réalisées dans le délai contractuel",
  SECURITE:  "Note sécurité du KPI marché (impact NC QHSE inclus)",
  QUALITE:   "Note qualité du KPI marché (impact NC QHSE inclus)",
  DOCUMENTS: "Taux de conformité documentaire (KPI Conformité)",
  RECEPTION: "Ratio montants réceptionnés / réalisés",
  PENALITES: "Ratio pénalités / montants réalisés (inversé)",
  ALERTES:   "Nombre d'alertes critiques ouvertes (−25 pts chacune)",
  BONUS:     "Présence de bonus contractuels",
};

export function ScoringClient({
  marketId,
  currentWeights,
  defaultWeights,
  metricLabels,
  isCustom: initialIsCustom,
  hasCustom: initialHasCustom,
  canEdit,
}: Props) {
  const [weights, setWeights] = useState<Record<string, number>>({ ...currentWeights });
  const [isCustom, setIsCustom] = useState<Record<string, boolean>>({ ...initialIsCustom });
  const [hasCustom, setHasCustom] = useState(initialHasCustom);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const totalOk = Math.abs(total - 100) <= 0.5;

  // Barre de couleur selon l'écart
  const totalColor = totalOk ? "text-green-600" : total > 100 ? "text-red-600" : "text-orange-500";

  const handleChange = useCallback((code: string, val: number) => {
    setWeights((prev) => ({ ...prev, [code]: Math.max(0, Math.min(100, val)) }));
  }, []);

  async function handleSave() {
    if (!totalOk) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/markets/${marketId}/score-weights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const data = await res.json();
      if (res.ok) {
        const custom: Record<string, boolean> = {};
        Object.keys(weights).forEach((k) => { custom[k] = true; });
        setIsCustom(custom);
        setHasCustom(true);
        setMessage({ type: "ok", text: "Pondérations sauvegardées. Le prochain calcul de score utilisera ces poids." });
      } else {
        setMessage({ type: "error", text: data.error ?? "Erreur serveur" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Réinitialiser aux poids par défaut ?")) return;
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/markets/${marketId}/score-weights`, { method: "DELETE" });
      if (res.ok) {
        setWeights({ ...defaultWeights });
        setIsCustom({});
        setHasCustom(false);
        setMessage({ type: "ok", text: "Pondérations réinitialisées aux valeurs par défaut." });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setResetting(false);
    }
  }

  // Distribuer l'écart restant sur les autres métriques (auto-équilibrage)
  function autoBalance(changedCode: string) {
    const current = weights[changedCode];
    const others = METRIC_ORDER.filter((k) => k !== changedCode);
    const remaining = 100 - current;
    const othersTotal = others.reduce((s, k) => s + weights[k], 0);

    if (othersTotal === 0) return;

    const newWeights = { ...weights };
    let distributed = 0;
    others.forEach((k, i) => {
      const ratio = weights[k] / othersTotal;
      const val = i === others.length - 1
        ? remaining - distributed
        : Math.round(ratio * remaining);
      newWeights[k] = Math.max(0, val);
      distributed += newWeights[k];
    });
    setWeights(newWeights);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Scoring personnalisé</h2>
          <p className="text-xs text-gray-500">
            {hasCustom
              ? "Ce marché utilise des poids personnalisés"
              : "Ce marché utilise les poids globaux par défaut"}
          </p>
        </div>
        {hasCustom && canEdit && (
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
            {resetting ? "Réinitialisation…" : "Réinitialiser les défauts"}
          </Button>
        )}
      </div>

      {/* Jauge totale */}
      <Card className={`border-2 ${totalOk ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Somme des poids</span>
            <span className={`text-2xl font-bold ${totalColor}`}>{total.toFixed(1)} %</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${totalOk ? "bg-green-500" : total > 100 ? "bg-red-500" : "bg-orange-400"}`}
              style={{ width: `${Math.min(total, 100)}%` }}
            />
          </div>
          {!totalOk && (
            <p className="text-xs text-orange-700 mt-1">
              {total > 100
                ? `Réduire de ${(total - 100).toFixed(1)} pts pour atteindre 100`
                : `Ajouter ${(100 - total).toFixed(1)} pts pour atteindre 100`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tableau des métriques */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pondération par indicateur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-4">
          {METRIC_ORDER.map((code) => {
            const label = metricLabels[code];
            const val = weights[code] ?? 0;
            const def = defaultWeights[code] ?? 0;
            const custom = isCustom[code] && val !== def;

            return (
              <div key={code} className="group py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  {/* Label */}
                  <div className="w-40 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800">{label}</span>
                      {custom && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">perso</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-tight">{METRIC_DESCRIPTIONS[code]}</p>
                  </div>

                  {/* Slider */}
                  <div className="flex-1">
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={1}
                      value={val}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(code, Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Valeur numérique */}
                  <div className="flex items-center gap-2 w-28 flex-shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      value={val}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(code, Number(e.target.value))}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>

                  {/* Bouton auto-équilibrage */}
                  {canEdit && (
                    <button
                      onClick={() => autoBalance(code)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:underline transition-opacity flex-shrink-0 w-20"
                      title="Répartir le reste proportionnellement sur les autres indicateurs"
                    >
                      équilibrer
                    </button>
                  )}

                  {/* Défaut */}
                  <div className="w-20 text-right flex-shrink-0">
                    <span className="text-xs text-gray-400">défaut : {def}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Message de retour */}
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message.type === "ok" ? "✅" : "❌"} {message.text}
        </p>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !totalOk}
            size="sm"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder les poids"}
          </Button>
          {!totalOk && (
            <span className="text-xs text-orange-600 self-center">
              La somme doit être exactement 100 %
            </span>
          )}
        </div>
      )}
    </div>
  );
}
