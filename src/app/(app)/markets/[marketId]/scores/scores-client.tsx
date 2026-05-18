"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreDetail {
  metricCode: string;
  label: string;
  weight: number;
  normalizedScore: number;
  weightedScore: number;
  color: "green" | "orange" | "red";
}

interface ScoreSnapshot {
  id: string;
  scoreValue: number;
  scoreLabel: string;
  calculatedAt: string;
  details: unknown;
}

interface Props {
  marketId: string;
  initialScores: ScoreSnapshot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(v: number) {
  if (v >= 80) return "#16a34a"; // green-600
  if (v >= 60) return "#f97316"; // orange-500
  return "#dc2626"; // red-600
}

function scoreBg(v: number) {
  if (v >= 80) return "bg-green-100 text-green-800";
  if (v >= 60) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function detailColor(c: "green" | "orange" | "red") {
  if (c === "green") return "text-green-600";
  if (c === "orange") return "text-orange-500";
  return "text-red-600";
}

function detailBg(c: "green" | "orange" | "red") {
  if (c === "green") return "bg-green-500";
  if (c === "orange") return "bg-orange-400";
  return "bg-red-500";
}

// ── Composant graphique SVG ───────────────────────────────────────────────────

const CHART_W = 700;
const CHART_H = 220;
const PAD = { top: 20, right: 20, bottom: 40, left: 40 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function ScoreLineChart({ scores }: { scores: ScoreSnapshot[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (scores.length === 0) return null;

  const xs = scores.map((_, i) => (i / Math.max(scores.length - 1, 1)) * INNER_W);
  const ys = scores.map((s) => INNER_H - (s.scoreValue / 100) * INNER_H);

  // Zone colorée sous la courbe
  const areaPath = [
    `M ${xs[0]} ${ys[0]}`,
    ...xs.slice(1).map((x, i) => `L ${x} ${ys[i + 1]}`),
    `L ${xs[xs.length - 1]} ${INNER_H}`,
    `L ${xs[0]} ${INNER_H}`,
    "Z",
  ].join(" ");

  // Ligne
  const linePath = [
    `M ${xs[0]} ${ys[0]}`,
    ...xs.slice(1).map((x, i) => `L ${x} ${ys[i + 1]}`),
  ].join(" ");

  // Graduation Y (0, 25, 50, 75, 100)
  const yTicks = [0, 25, 50, 75, 100];

  // Graduation X (afficher max 6 étiquettes)
  const xStep = Math.max(1, Math.floor(scores.length / 6));
  const xTicks = scores
    .map((s, i) => ({ i, label: format(new Date(s.calculatedAt), "d MMM", { locale: fr }) }))
    .filter((_, i) => i % xStep === 0 || i === scores.length - 1);

  // Zone de seuils (couleur de fond)
  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ minWidth: 360 }}
      >
        <g transform={`translate(${PAD.left}, ${PAD.top})`}>
          {/* Zones de seuil */}
          <rect x={0} y={0} width={INNER_W} height={INNER_H * 0.2} fill="#fee2e2" opacity={0.4} />
          <rect x={0} y={INNER_H * 0.2} width={INNER_W} height={INNER_H * 0.2} fill="#ffedd5" opacity={0.4} />
          <rect x={0} y={INNER_H * 0.4} width={INNER_W} height={INNER_H * 0.6} fill="#dcfce7" opacity={0.3} />

          {/* Lignes horizontales */}
          {yTicks.map((t) => {
            const y = INNER_H - (t / 100) * INNER_H;
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={INNER_W} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={-6} y={y + 4} fontSize={10} fill="#9ca3af" textAnchor="end">{t}</text>
              </g>
            );
          })}

          {/* Étiquettes X */}
          {xTicks.map(({ i, label }) => (
            <text
              key={i}
              x={xs[i]}
              y={INNER_H + 16}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}

          {/* Aire sous la courbe */}
          <path d={areaPath} fill="#3b82f6" opacity={0.08} />

          {/* Ligne */}
          <path d={linePath} stroke="#3b82f6" strokeWidth={2} fill="none" strokeLinejoin="round" />

          {/* Points */}
          {scores.map((s, i) => (
            <g key={s.id}>
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r={hovered === i ? 6 : 4}
                fill={scoreColor(s.scoreValue)}
                stroke="white"
                strokeWidth={2}
                style={{ cursor: "pointer", transition: "r 0.1s" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          ))}

          {/* Tooltip */}
          {hovered !== null && (
            (() => {
              const s = scores[hovered];
              const x = xs[hovered];
              const y = ys[hovered];
              const tooltipX = x > INNER_W - 120 ? x - 110 : x + 10;
              const tooltipY = y < 50 ? y + 10 : y - 52;
              return (
                <g>
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={100}
                    height={44}
                    rx={6}
                    fill="white"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                    filter="url(#shadow)"
                  />
                  <text x={tooltipX + 8} y={tooltipY + 16} fontSize={11} fontWeight={600} fill={scoreColor(s.scoreValue)}>
                    {s.scoreValue}/100
                  </text>
                  <text x={tooltipX + 8} y={tooltipY + 28} fontSize={10} fill="#6b7280">
                    {s.scoreLabel}
                  </text>
                  <text x={tooltipX + 8} y={tooltipY + 40} fontSize={9} fill="#9ca3af">
                    {format(new Date(s.calculatedAt), "d MMM yyyy", { locale: fr })}
                  </text>
                </g>
              );
            })()
          )}

          {/* Filtre ombre pour tooltip */}
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx={0} dy={2} stdDeviation={3} floodOpacity={0.08} />
            </filter>
          </defs>
        </g>
      </svg>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function ScoresClient({ marketId, initialScores }: Props) {
  const [scores, setScores] = useState<ScoreSnapshot[]>(initialScores);
  const [selected, setSelected] = useState<ScoreSnapshot | null>(
    initialScores.length > 0 ? initialScores[initialScores.length - 1] : null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleForceSnapshot = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/markets/${marketId}/scores`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const newSnapshot: ScoreSnapshot = data.snapshot;
        setScores((prev) => {
          // Remplacer le dernier si même jour, sinon ajouter
          const last = prev[prev.length - 1];
          if (
            last &&
            new Date(last.calculatedAt).toDateString() ===
              new Date(newSnapshot.calculatedAt).toDateString()
          ) {
            return [...prev.slice(0, -1), newSnapshot];
          }
          return [...prev, newSnapshot];
        });
        setSelected(newSnapshot);
        setMessage(`Score calculé : ${newSnapshot.scoreValue}/100 — ${newSnapshot.scoreLabel}`);
      } else {
        setMessage(data.error ?? "Erreur lors du calcul");
      }
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }, [marketId]);

  const selectedDetails = selected?.details
    ? (selected.details as ScoreDetail[])
    : null;

  // Variation depuis le premier snapshot
  const variation =
    scores.length >= 2
      ? scores[scores.length - 1].scoreValue - scores[0].scoreValue
      : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Historique des scores</h2>
          <p className="text-xs text-gray-500">
            {scores.length === 0
              ? "Aucun snapshot enregistré — consultez la Vue d'ensemble pour générer le premier"
              : `${scores.length} snapshot(s) — du ${format(new Date(scores[0].calculatedAt), "d MMM yyyy", { locale: fr })} au ${format(new Date(scores[scores.length - 1].calculatedAt), "d MMM yyyy", { locale: fr })}`}
          </p>
        </div>
        <Button size="sm" onClick={handleForceSnapshot} disabled={saving}>
          {saving ? "Calcul…" : "Calculer maintenant"}
        </Button>
      </div>

      {message && (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
          {message}
        </p>
      )}

      {scores.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-400">
            <p className="mb-1">Aucune donnée d'historique disponible.</p>
            <p>Visitez la <strong>Vue d'ensemble</strong> du marché pour générer un premier snapshot automatique,<br />ou cliquez sur <strong>Calculer maintenant</strong> ci-dessus.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs résumés */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Score actuel</p>
                <p
                  className="text-3xl font-bold"
                  style={{ color: scoreColor(scores[scores.length - 1].scoreValue) }}
                >
                  {scores[scores.length - 1].scoreValue}
                </p>
                <p className="text-sm text-gray-400">/100</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-medium ${scoreBg(scores[scores.length - 1].scoreValue)}`}>
                  {scores[scores.length - 1].scoreLabel}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Score min / max</p>
                <p className="text-xl font-bold text-gray-800">
                  <span style={{ color: scoreColor(Math.min(...scores.map((s) => s.scoreValue))) }}>
                    {Math.min(...scores.map((s) => s.scoreValue))}
                  </span>
                  {" / "}
                  <span style={{ color: scoreColor(Math.max(...scores.map((s) => s.scoreValue))) }}>
                    {Math.max(...scores.map((s) => s.scoreValue))}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">sur la période</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Évolution globale</p>
                {variation !== null ? (
                  <>
                    <p
                      className="text-xl font-bold"
                      style={{
                        color:
                          variation > 0 ? "#16a34a" : variation < 0 ? "#dc2626" : "#6b7280",
                      }}
                    >
                      {variation > 0 ? "+" : ""}
                      {variation} pts
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {variation > 0
                        ? "En progression"
                        : variation < 0
                        ? "En recul"
                        : "Stable"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">— (1 seul point)</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Graphique */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Évolution du score dans le temps</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {/* Légende seuils */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-200 inline-block" /> ≥ 80 — Bon</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-200 inline-block" /> 60–79 — Sous surveillance</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-200 inline-block" /> &lt; 60 — En difficulté</span>
              </div>
              <ScoreLineChart scores={scores} />
            </CardContent>
          </Card>

          {/* Tableau des snapshots + détail */}
          <div className="grid grid-cols-2 gap-4">

            {/* Liste des snapshots */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Snapshots</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400">
                        <th className="text-left px-4 py-2 font-medium">Date</th>
                        <th className="text-right px-4 py-2 font-medium">Score</th>
                        <th className="text-left px-4 py-2 font-medium">Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...scores].reverse().map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            selected?.id === s.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="px-4 py-2 text-gray-600 text-xs">
                            {format(new Date(s.calculatedAt), "d MMM yyyy, HH:mm", { locale: fr })}
                          </td>
                          <td className="px-4 py-2 text-right font-bold" style={{ color: scoreColor(s.scoreValue) }}>
                            {s.scoreValue}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${scoreBg(s.scoreValue)}`}>
                              {s.scoreLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Détail du snapshot sélectionné */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Détail{" "}
                  {selected && (
                    <span className="text-gray-400 font-normal">
                      — {format(new Date(selected.calculatedAt), "d MMM yyyy", { locale: fr })}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!selected || !selectedDetails ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Cliquez sur un snapshot pour voir le détail par indicateur.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDetails.map((d) => (
                      <div key={d.metricCode} className="flex items-center gap-3">
                        <div className="w-28 flex-shrink-0">
                          <p className="text-xs font-medium text-gray-700">{d.label}</p>
                          <p className="text-xs text-gray-400">{d.weight}%</p>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${detailBg(d.color)}`}
                            style={{ width: `${d.normalizedScore}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-8 text-right ${detailColor(d.color)}`}>
                          {Math.round(d.normalizedScore)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">Score total</span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: scoreColor(selected.scoreValue) }}
                      >
                        {selected.scoreValue}/100
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
