"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

type NcType     = "QUALITE" | "SECURITE" | "ENVIRONNEMENT";
type NcSeverity = "MINEURE" | "MAJEURE" | "CRITIQUE";
type NcStatus   = "OUVERTE" | "EN_COURS" | "CLOTUREE";

interface Nc {
  id: string;
  ncType: NcType;
  severity: NcSeverity;
  description: string;
  detectedAt: string;
  rootCause: string | null;
  correctiveAction: string | null;
  status: NcStatus;
  closedAt: string | null;
  scoreImpact: number;
  projectId: string | null;
  project: { projectCode: string; siteName: string | null } | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface Project {
  id: string;
  projectCode: string;
  siteName: string | null;
}

interface Props {
  marketId: string;
  ncs: Nc[];
  projects: Project[];
  canWrite: boolean;
  canClose: boolean;
}

// ── Labels & couleurs ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<NcType, { label: string; color: string }> = {
  QUALITE:       { label: "Qualité",       color: "bg-blue-100 text-blue-800" },
  SECURITE:      { label: "Sécurité",      color: "bg-red-100 text-red-800" },
  ENVIRONNEMENT: { label: "Environnement", color: "bg-green-100 text-green-800" },
};

const SEV_LABELS: Record<NcSeverity, { label: string; color: string; dot: string }> = {
  MINEURE:  { label: "Mineure",  color: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-400" },
  MAJEURE:  { label: "Majeure",  color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  CRITIQUE: { label: "Critique", color: "bg-red-100 text-red-800",       dot: "bg-red-600"    },
};

const STATUS_LABELS: Record<NcStatus, { label: string; color: string }> = {
  OUVERTE:   { label: "Ouverte",   color: "bg-red-100 text-red-700" },
  EN_COURS:  { label: "En cours",  color: "bg-yellow-100 text-yellow-800" },
  CLOTUREE:  { label: "Clôturée",  color: "bg-green-100 text-green-800" },
};

const NC_IMPACT: Record<NcSeverity, number> = { MINEURE: 1, MAJEURE: 3, CRITIQUE: 5 };

function fmtDate(iso: string) {
  return format(new Date(iso), "d MMM yyyy", { locale: fr });
}

// ── Formulaire vide ────────────────────────────────────────────────────────

interface FormState {
  ncType: NcType;
  severity: NcSeverity;
  description: string;
  detectedAt: string;
  rootCause: string;
  correctiveAction: string;
  projectId: string;
}

const emptyForm: FormState = {
  ncType: "QUALITE",
  severity: "MAJEURE",
  description: "",
  detectedAt: new Date().toISOString().slice(0, 10),
  rootCause: "",
  correctiveAction: "",
  projectId: "",
};

// ── Composant ──────────────────────────────────────────────────────────────

export function NcClient({ marketId, ncs: initialNcs, projects, canWrite, canClose }: Props) {
  const [ncs, setNcs] = useState<Nc[]>(initialNcs);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<NcStatus | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────
  const open = ncs.filter((n) => n.status !== "CLOTUREE");
  const totalImpact = open.reduce((s, n) => s + n.scoreImpact, 0);
  const byType = {
    QUALITE:       open.filter((n) => n.ncType === "QUALITE").length,
    SECURITE:      open.filter((n) => n.ncType === "SECURITE").length,
    ENVIRONNEMENT: open.filter((n) => n.ncType === "ENVIRONNEMENT").length,
  };

  // ── Filtre ────────────────────────────────────────────────────────────
  const displayed = filterStatus === "ALL" ? ncs : ncs.filter((n) => n.status === filterStatus);

  // ── Actions ───────────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(n: Nc) {
    setEditingId(n.id);
    setForm({
      ncType: n.ncType,
      severity: n.severity,
      description: n.description,
      detectedAt: n.detectedAt.slice(0, 10),
      rootCause: n.rootCause ?? "",
      correctiveAction: n.correctiveAction ?? "",
      projectId: n.projectId ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() { setShowForm(false); setEditingId(null); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { setError("La description est requise."); return; }
    setSaving(true); setError(null);

    const payload = {
      ncType: form.ncType,
      severity: form.severity,
      description: form.description.trim(),
      detectedAt: form.detectedAt,
      rootCause: form.rootCause || null,
      correctiveAction: form.correctiveAction || null,
      projectId: form.projectId || null,
    };

    try {
      const url = editingId
        ? `/api/markets/${marketId}/nc/${editingId}`
        : `/api/markets/${marketId}/nc`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) { setError((await res.json()).error ?? "Erreur"); return; }
      const saved: Nc = await res.json();

      if (editingId) {
        setNcs((prev) => prev.map((n) => (n.id === editingId ? saved : n)));
      } else {
        setNcs((prev) => [saved, ...prev]);
      }
      setShowForm(false); setEditingId(null);
    } catch { setError("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function handleClose(id: string) {
    if (!confirm("Clôturer cette NC ? Les points de score seront restitués.")) return;
    setClosingId(id);
    try {
      const res = await fetch(`/api/markets/${marketId}/nc/${id}/close`, { method: "POST" });
      if (res.ok) {
        const updated: Nc = await res.json();
        setNcs((prev) => prev.map((n) => (n.id === id ? updated : n)));
      }
    } finally { setClosingId(null); }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Non-conformités QHSE</h2>
          <p className="text-xs text-gray-500">{ncs.length} NC enregistrée(s)</p>
        </div>
        {canWrite && !showForm && (
          <Button size="sm" onClick={openCreate}>+ Nouvelle NC</Button>
        )}
      </div>

      {/* Tableau de bord synthèse */}
      {ncs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 bg-gray-50">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">NC ouvertes</p>
              <p className="text-2xl font-bold text-gray-900">{open.length}</p>
            </CardContent>
          </Card>
          <Card className={`border-0 ${totalImpact > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Impact score</p>
              <p className={`text-2xl font-bold ${totalImpact > 0 ? "text-red-600" : "text-gray-900"}`}>
                {totalImpact > 0 ? `−${totalImpact} pts` : "0 pt"}
              </p>
            </CardContent>
          </Card>
          {Object.entries(byType).map(([type, count]) => {
            const t = TYPE_LABELS[type as NcType];
            return (
              <Card key={type} className="border-0 bg-gray-50">
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{t.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editingId ? "Modifier la NC" : "Nouvelle non-conformité"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={form.ncType}
                    onChange={(e) => setForm({ ...form, ncType: e.target.value as NcType })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="QUALITE">Qualité</option>
                    <option value="SECURITE">Sécurité</option>
                    <option value="ENVIRONNEMENT">Environnement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gravité *</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as NcSeverity })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MINEURE">Mineure (−1 pt)</option>
                    <option value="MAJEURE">Majeure (−3 pts)</option>
                    <option value="CRITIQUE">Critique (−5 pts)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date de détection *</label>
                  <input
                    type="date"
                    value={form.detectedAt}
                    onChange={(e) => setForm({ ...form, detectedAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Chantier associé</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Aucun —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode}{p.siteName ? ` — ${p.siteName}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Décrivez précisément la non-conformité constatée"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cause racine</label>
                  <textarea
                    value={form.rootCause}
                    onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Pourquoi cette NC s'est-elle produite ?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Action corrective</label>
                  <textarea
                    value={form.correctiveAction}
                    onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Mesure mise en place pour corriger"
                  />
                </div>
              </div>

              {!editingId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
                  ⚠️ Cette NC appliquera un malus de <strong>−{NC_IMPACT[form.severity]} point(s)</strong> sur le KPI {form.ncType === "SECURITE" ? "Sécurité" : "Qualité"} du marché.
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={cancelForm}>Annuler</Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Créer la NC"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtre statut */}
      {ncs.length > 0 && (
        <div className="flex gap-2">
          {(["ALL", "OUVERTE", "EN_COURS", "CLOTUREE"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "ALL" ? "Toutes" : STATUS_LABELS[s].label}
              {s !== "ALL" && (
                <span className="ml-1 opacity-70">({ncs.filter((n) => n.status === s).length})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {displayed.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Aucune non-conformité enregistrée.
            {canWrite && (
              <><br /><button onClick={openCreate} className="mt-3 text-blue-600 hover:underline text-sm">+ Créer la première NC</button></>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((n) => {
            const t = TYPE_LABELS[n.ncType];
            const s = SEV_LABELS[n.severity];
            const st = STATUS_LABELS[n.status];
            const isClosed = n.status === "CLOTUREE";

            return (
              <Card key={n.id} className={`transition-shadow hover:shadow-sm ${isClosed ? "opacity-60" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Indicateur de gravité */}
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${s.dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.description}</p>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                          {!isClosed && (
                            <span className="text-xs text-red-600 font-medium">−{n.scoreImpact} pt{n.scoreImpact > 1 ? "s" : ""}</span>
                          )}
                          {isClosed && (
                            <span className="text-xs text-green-600 font-medium">+{n.scoreImpact} pt{n.scoreImpact > 1 ? "s" : ""} restitués</span>
                          )}
                          {n.project && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {n.project.siteName ?? n.project.projectCode}
                            </span>
                          )}
                        </div>

                        {/* Détails */}
                        {(n.rootCause || n.correctiveAction) && (
                          <div className="mt-2 space-y-1">
                            {n.rootCause && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Cause : </span>{n.rootCause}
                              </p>
                            )}
                            {n.correctiveAction && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Action : </span>{n.correctiveAction}
                              </p>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-1">
                          Détectée le {fmtDate(n.detectedAt)} ·{" "}
                          {n.createdBy.firstName} {n.createdBy.lastName}
                          {n.closedAt && ` · Clôturée le ${fmtDate(n.closedAt)}`}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isClosed && (
                      <div className="flex gap-1 flex-shrink-0">
                        {canWrite && (
                          <button
                            onClick={() => openEdit(n)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canClose && (
                          <button
                            onClick={() => handleClose(n.id)}
                            disabled={closingId === n.id}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                            title="Clôturer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
