"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

interface Avenant {
  id: string;
  avenantNumber: number;
  nature: string;
  signedAt: string | null;
  deltaAmountHt: number | null;
  deltaDelayDays: number | null;
  status: "EN_COURS" | "SIGNE" | "REFUSE";
  notes: string | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface Market {
  id: string;
  marketCode: string;
  title: string;
  firmAmountHt: number | null;
}

interface Props {
  market: Market;
  initialAvenants: Avenant[];
  canEdit: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  EN_COURS: { label: "En cours", color: "bg-yellow-100 text-yellow-800" },
  SIGNE:    { label: "Signé",    color: "bg-green-100 text-green-800" },
  REFUSE:   { label: "Refusé",   color: "bg-red-100 text-red-800" },
};

function fmt(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string) {
  return format(new Date(iso), "d MMM yyyy", { locale: fr });
}

// ── Formulaire ─────────────────────────────────────────────────────────────

interface FormState {
  nature: string;
  signedAt: string;
  deltaAmountHt: string;
  deltaDelayDays: string;
  status: "EN_COURS" | "SIGNE" | "REFUSE";
  notes: string;
}

const emptyForm: FormState = {
  nature: "",
  signedAt: "",
  deltaAmountHt: "",
  deltaDelayDays: "",
  status: "EN_COURS",
  notes: "",
};

// ── Composant principal ────────────────────────────────────────────────────

export function AvenantsClient({ market, initialAvenants, canEdit }: Props) {
  const [avenants, setAvenants] = useState<Avenant[]>(initialAvenants);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Calculs cumulatifs ──────────────────────────────────────────────────
  const signedAvenants = avenants.filter((a) => a.status === "SIGNE");
  const totalDeltaAmount = signedAvenants.reduce((s, a) => s + (a.deltaAmountHt ?? 0), 0);
  const totalDeltaDays = signedAvenants.reduce((s, a) => s + (a.deltaDelayDays ?? 0), 0);
  const revisedAmount = market.firmAmountHt !== null ? market.firmAmountHt + totalDeltaAmount : null;
  const driftPct = market.firmAmountHt ? (totalDeltaAmount / market.firmAmountHt) * 100 : null;
  const driftWarning = driftPct !== null && Math.abs(driftPct) >= 20;

  // ── Actions formulaire ──────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: Avenant) {
    setEditingId(a.id);
    setForm({
      nature: a.nature,
      signedAt: a.signedAt ? a.signedAt.slice(0, 10) : "",
      deltaAmountHt: a.deltaAmountHt !== null ? String(a.deltaAmountHt) : "",
      deltaDelayDays: a.deltaDelayDays !== null ? String(a.deltaDelayDays) : "",
      status: a.status,
      notes: a.notes ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nature.trim()) { setError("L'objet de l'avenant est requis."); return; }
    setSaving(true);
    setError(null);

    const payload = {
      nature: form.nature.trim(),
      signedAt: form.signedAt || null,
      deltaAmountHt: form.deltaAmountHt !== "" ? Number(form.deltaAmountHt) : null,
      deltaDelayDays: form.deltaDelayDays !== "" ? Number(form.deltaDelayDays) : null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      const url = editingId
        ? `/api/markets/${market.id}/avenants/${editingId}`
        : `/api/markets/${market.id}/avenants`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur serveur");
        return;
      }

      const saved: Avenant = await res.json();

      if (editingId) {
        setAvenants((prev) => prev.map((a) => (a.id === editingId ? saved : a)));
      } else {
        setAvenants((prev) => [...prev, saved]);
      }

      setShowForm(false);
      setEditingId(null);
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet avenant ?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/markets/${market.id}/avenants/${id}`, { method: "DELETE" });
      if (res.ok) setAvenants((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Rendu ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Avenants contractuels</h2>
          <p className="text-xs text-gray-500">{avenants.length} avenant(s) enregistré(s)</p>
        </div>
        {canEdit && !showForm && (
          <Button size="sm" onClick={openCreate}>+ Nouvel avenant</Button>
        )}
      </div>

      {/* Récapitulatif financier */}
      {market.firmAmountHt !== null && (
        <div className={`rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-4 ${driftWarning ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Marché initial</p>
            <p className="text-sm font-semibold text-gray-900">{fmt(market.firmAmountHt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cumul avenants signés</p>
            <p className={`text-sm font-semibold ${totalDeltaAmount >= 0 ? "text-green-700" : "text-red-600"}`}>
              {totalDeltaAmount >= 0 ? "+" : ""}{fmt(totalDeltaAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Montant révisé</p>
            <p className="text-sm font-semibold text-gray-900">{fmt(revisedAmount ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Dérive</p>
            <p className={`text-sm font-semibold ${driftWarning ? "text-red-600" : "text-gray-700"}`}>
              {driftPct !== null ? `${driftPct >= 0 ? "+" : ""}${driftPct.toFixed(1)} %` : "—"}
              {driftWarning && " ⚠️"}
            </p>
          </div>
          {totalDeltaDays !== 0 && (
            <div className="col-span-2 md:col-span-4 border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Prolongation délai signée</p>
              <p className={`text-sm font-semibold ${totalDeltaDays >= 0 ? "text-blue-700" : "text-red-600"}`}>
                {totalDeltaDays >= 0 ? "+" : ""}{totalDeltaDays} jour(s)
              </p>
            </div>
          )}
          {driftWarning && (
            <p className="col-span-2 md:col-span-4 text-xs text-red-700 font-medium">
              ⚠️ La dérive contractuelle dépasse 20 % du marché initial — vérification recommandée.
            </p>
          )}
        </div>
      )}

      {/* Formulaire d'ajout / édition */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editingId ? "Modifier l'avenant" : "Nouvel avenant"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Objet / nature *</label>
                <input
                  type="text"
                  value={form.nature}
                  onChange={(e) => setForm({ ...form, nature: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex. Prolongation de 6 mois suite à aléas techniques"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date de signature</label>
                  <input
                    type="date"
                    value={form.signedAt}
                    onChange={(e) => setForm({ ...form, signedAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Variation montant HT (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.deltaAmountHt}
                    onChange={(e) => setForm({ ...form, deltaAmountHt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex. 15000 ou -5000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Variation délai (jours)</label>
                  <input
                    type="number"
                    value={form.deltaDelayDays}
                    onChange={(e) => setForm({ ...form, deltaDelayDays: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex. 180 ou -30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EN_COURS">En cours</option>
                  <option value="SIGNE">Signé</option>
                  <option value="REFUSE">Refusé</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes internes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Contexte, remarques, pièces jointes…"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={cancelForm}>Annuler</Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Créer l'avenant"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des avenants */}
      {avenants.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Aucun avenant enregistré pour ce marché.
            {canEdit && (
              <><br /><button onClick={openCreate} className="mt-3 text-blue-600 hover:underline text-sm">+ Créer le premier avenant</button></>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {avenants.map((a) => {
            const s = STATUS_LABELS[a.status];
            return (
              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                        {a.avenantNumber}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{a.nature}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                            {s.label}
                          </span>
                          {a.signedAt && (
                            <span className="text-xs text-gray-500">Signé le {fmtDate(a.signedAt)}</span>
                          )}
                          {a.deltaAmountHt !== null && (
                            <span className={`text-xs font-medium ${a.deltaAmountHt >= 0 ? "text-green-700" : "text-red-600"}`}>
                              {a.deltaAmountHt >= 0 ? "+" : ""}{fmt(a.deltaAmountHt)}
                            </span>
                          )}
                          {a.deltaDelayDays !== null && a.deltaDelayDays !== 0 && (
                            <span className={`text-xs font-medium ${a.deltaDelayDays >= 0 ? "text-blue-600" : "text-red-600"}`}>
                              {a.deltaDelayDays >= 0 ? "+" : ""}{a.deltaDelayDays}j
                            </span>
                          )}
                        </div>
                        {a.notes && (
                          <p className="text-xs text-gray-500 mt-1">{a.notes}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Créé par {a.createdBy.firstName} {a.createdBy.lastName} · {fmtDate(a.createdAt)}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
