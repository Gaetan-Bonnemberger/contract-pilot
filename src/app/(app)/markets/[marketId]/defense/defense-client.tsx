"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { MarketScoreResult } from "@/lib/score";

type Trend = "HAUSSE" | "STABLE" | "BAISSE";

interface NoteState {
  justification: string;
  actionPlan: string;
  trend: Trend;
}

interface MarketMeta {
  id: string;
  marketCode: string;
  title: string;
  clientName: string;
  responsible: string | null;
  startDate: string | null;
  endDate: string | null;
  printDate: string;
}

interface Props {
  market: MarketMeta;
  scoreResult: MarketScoreResult;
  metricLabels: Record<string, string>;
  initialNotes: Record<string, NoteState>;
  canEdit: boolean;
}

const TREND_CONFIG: Record<Trend, { label: string; icon: string; color: string }> = {
  HAUSSE: { label: "En hausse",  icon: "↑", color: "text-green-600" },
  STABLE: { label: "Stable",     icon: "→", color: "text-gray-500"  },
  BAISSE: { label: "En baisse",  icon: "↓", color: "text-red-600"   },
};

const SCORE_COLOR = (v: number) =>
  v >= 80 ? "#16a34a" : v >= 60 ? "#d97706" : "#dc2626";

const SCORE_LABEL = (v: number) =>
  v >= 80 ? "Bon" : v >= 60 ? "Sous surveillance" : v >= 40 ? "En difficulté" : "Critique";

export function DefenseClient({ market, scoreResult, metricLabels, initialNotes, canEdit }: Props) {
  const defaultNote = (): NoteState => ({ justification: "", actionPlan: "", trend: "STABLE" });

  const [notes, setNotes] = useState<Record<string, NoteState>>(
    Object.fromEntries(
      scoreResult.details.map((d) => [
        d.metricCode,
        initialNotes[d.metricCode] ?? defaultNote(),
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  function updateNote(code: string, field: keyof NoteState, value: string) {
    setNotes((prev) => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/markets/${market.id}/defense`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* ── Styles d'impression ──────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #defense-print, #defense-print * { visibility: visible !important; }
          #defense-print { position: absolute; inset: 0; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* En-tête écran */}
        <div className="flex items-start justify-between no-print">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Défense de marché</h2>
            <p className="text-xs text-gray-500">
              Préparez vos justifications par indicateur pour la revue contractuelle client
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? "Sauvegarde…" : saved ? "✅ Sauvegardé" : "Sauvegarder"}
              </Button>
            )}
            <Button size="sm" onClick={handlePrint}>
              🖨️ Exporter PDF
            </Button>
          </div>
        </div>

        {/* ── Zone imprimable ─────────────────────────────────────────────── */}
        <div id="defense-print" ref={printRef} className="space-y-6">

          {/* Page de garde */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Revue contractuelle
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{market.title}</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  <span className="font-mono text-blue-700">{market.marketCode}</span>
                  {" · "}{market.clientName}
                </p>
              </div>
              <div className="text-right text-sm text-gray-500 space-y-0.5">
                {market.responsible && <p>Responsable : <strong className="text-gray-800">{market.responsible}</strong></p>}
                {market.startDate && market.endDate && (
                  <p>Période : {market.startDate} → {market.endDate}</p>
                )}
                <p>Édité le {market.printDate}</p>
              </div>
            </div>

            {/* Score global */}
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 text-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md"
                  style={{ backgroundColor: SCORE_COLOR(scoreResult.total) }}
                >
                  {scoreResult.total}
                </div>
                <p className="text-xs text-gray-500 mt-1">/ 100</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-800">
                  Score santé :{" "}
                  <span style={{ color: SCORE_COLOR(scoreResult.total) }}>
                    {SCORE_LABEL(scoreResult.total)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {scoreResult.details.map((d) => (
                    <div key={d.metricCode} className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">{d.label}</span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: d.color === "green" ? "#dcfce7" : d.color === "orange" ? "#ffedd5" : "#fee2e2",
                          color: d.color === "green" ? "#15803d" : d.color === "orange" ? "#c2410c" : "#991b1b",
                        }}
                      >
                        {d.normalizedScore.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Détail par indicateur */}
          <div className="space-y-4">
            {scoreResult.details.map((detail) => {
              const note = notes[detail.metricCode] ?? defaultNote();
              const trend = TREND_CONFIG[note.trend];

              return (
                <div
                  key={detail.metricCode}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                >
                  {/* Header indicateur */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Score bulle */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: SCORE_COLOR(detail.normalizedScore) }}
                      >
                        {detail.normalizedScore.toFixed(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {detail.label}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Poids : {detail.weight}% · Score pondéré : {detail.weightedScore.toFixed(1)} pts
                        </p>
                      </div>
                    </div>

                    {/* Tendance */}
                    <div className="flex items-center gap-2 no-print">
                      {(["HAUSSE", "STABLE", "BAISSE"] as Trend[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateNote(detail.metricCode, "trend", t)}
                          disabled={!canEdit}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                            note.trend === t
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          } disabled:cursor-not-allowed`}
                        >
                          {TREND_CONFIG[t].icon} {TREND_CONFIG[t].label}
                        </button>
                      ))}
                    </div>

                    {/* Tendance version print */}
                    <div className={`hidden print:flex items-center gap-1 text-sm font-medium ${trend.color}`}>
                      <span className="text-lg">{trend.icon}</span>
                      <span>{trend.label}</span>
                    </div>
                  </div>

                  {/* Barre de score */}
                  <div className="mb-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${detail.normalizedScore}%`,
                          backgroundColor: SCORE_COLOR(detail.normalizedScore),
                        }}
                      />
                    </div>
                  </div>

                  {/* Champs éditables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                        Contexte & justification
                      </label>
                      {canEdit ? (
                        <textarea
                          value={note.justification}
                          onChange={(e) => updateNote(detail.metricCode, "justification", e.target.value)}
                          rows={4}
                          placeholder="Expliquez le niveau de cet indicateur au client…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none no-print"
                        />
                      ) : null}
                      {/* Version print */}
                      <div className="hidden print:block text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap">
                        {note.justification || <span className="text-gray-300 italic">Aucune justification renseignée</span>}
                      </div>
                      {/* Version écran (lecture seule) */}
                      {!canEdit && (
                        <p className="text-sm text-gray-700 no-print">
                          {note.justification || <span className="text-gray-400 italic">Aucune justification</span>}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                        Plan d'action
                      </label>
                      {canEdit ? (
                        <textarea
                          value={note.actionPlan}
                          onChange={(e) => updateNote(detail.metricCode, "actionPlan", e.target.value)}
                          rows={4}
                          placeholder="Actions engagées ou prévues pour améliorer cet indicateur…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none no-print"
                        />
                      ) : null}
                      {/* Version print */}
                      <div className="hidden print:block text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap">
                        {note.actionPlan || <span className="text-gray-300 italic">Aucun plan d'action renseigné</span>}
                      </div>
                      {!canEdit && (
                        <p className="text-sm text-gray-700 no-print">
                          {note.actionPlan || <span className="text-gray-400 italic">Aucun plan d'action</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pied de page print */}
          <div className="hidden print:block text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
            Document généré par Contract Pilot · {market.printDate} · Confidentiel
          </div>

        </div>

        {/* Bouton bas de page */}
        {canEdit && (
          <div className="flex gap-2 no-print pb-4">
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Sauvegarde…" : saved ? "✅ Sauvegardé" : "Sauvegarder"}
            </Button>
            <Button size="sm" onClick={handlePrint}>
              🖨️ Exporter PDF
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
