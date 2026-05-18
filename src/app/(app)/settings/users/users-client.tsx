"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

type UserRole = "ADMIN" | "DIRECTEUR" | "RESPONSABLE_MARCHE" | "EXPLOITATION" | "QSE" | "LECTURE";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  _count: { responsibleMarkets: number };
}

interface Props {
  initialUsers: User[];
  currentUserId: string;
}

// ── Labels ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:              "Administrateur",
  DIRECTEUR:          "Directeur",
  RESPONSABLE_MARCHE: "Responsable Marché",
  EXPLOITATION:       "Exploitation",
  QSE:                "QSE",
  LECTURE:            "Lecture seule",
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:              "bg-purple-100 text-purple-800",
  DIRECTEUR:          "bg-blue-100 text-blue-800",
  RESPONSABLE_MARCHE: "bg-indigo-100 text-indigo-800",
  EXPLOITATION:       "bg-orange-100 text-orange-800",
  QSE:                "bg-green-100 text-green-800",
  LECTURE:            "bg-gray-100 text-gray-600",
};

// ── Formulaire vide ────────────────────────────────────────────────────────

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "RESPONSABLE_MARCHE",
  password: "",
  confirmPassword: "",
};

// ── Composant principal ────────────────────────────────────────────────────

export function UsersClient({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Réinitialisation de mot de passe
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Filtre
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const displayed = users.filter((u) =>
    filterActive === "all" ? true : filterActive === "active" ? u.isActive : !u.isActive
  );

  // ── Formulaire création / édition ─────────────────────────────────────

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditingUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      password: "",
      confirmPassword: "",
    });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() { setShowForm(false); setEditingUser(null); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Prénom, nom et email sont obligatoires."); return;
    }
    if (!editingUser && !form.password) {
      setError("Un mot de passe est requis à la création."); return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas."); return;
    }
    if (form.password && form.password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères."); return;
    }

    setSaving(true); setError(null);

    try {
      if (editingUser) {
        // Mise à jour
        const body: Record<string, unknown> = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
        };

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Erreur"); return; }
        const updated: User = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)));

        // Changer le mot de passe si renseigné
        if (form.password) {
          await fetch(`/api/users/${editingUser.id}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: form.password }),
          });
        }
      } else {
        // Création
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            role: form.role,
            password: form.password,
          }),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Erreur"); return; }
        const created: User = await res.json();
        setUsers((prev) => [created, ...prev]);
      }

      setShowForm(false); setEditingUser(null);
    } catch { setError("Erreur réseau"); }
    finally { setSaving(false); }
  }

  // ── Activer / désactiver ───────────────────────────────────────────────

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    }
  }

  // ── Supprimer ──────────────────────────────────────────────────────────

  async function handleDelete(u: User) {
    const msg = u._count.responsibleMarkets > 0
      ? `${u.firstName} ${u.lastName} est responsable de ${u._count.responsibleMarkets} marché(s). Le compte sera désactivé (pas supprimé). Continuer ?`
      : `Supprimer définitivement ${u.firstName} ${u.lastName} ?`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.action === "deleted") {
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
      } else {
        // Désactivé (responsable de marchés)
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: false } : x)));
      }
    }
  }

  // ── Réinitialisation MDP ────────────────────────────────────────────────

  function openReset(userId: string) {
    setResetUserId(userId); setResetPassword(""); setResetConfirm("");
    setResetError(null); setResetSuccess(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetPassword !== resetConfirm) { setResetError("Les mots de passe ne correspondent pas."); return; }
    if (resetPassword.length < 8) { setResetError("Minimum 8 caractères."); return; }
    setResetSaving(true); setResetError(null);
    try {
      const res = await fetch(`/api/users/${resetUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (res.ok) { setResetSuccess(true); setTimeout(() => setResetUserId(null), 1500); }
      else { setResetError((await res.json()).error ?? "Erreur"); }
    } catch { setResetError("Erreur réseau"); }
    finally { setResetSaving(false); }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterActive === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? `Tous (${users.length})` : f === "active" ? `Actifs (${users.filter(u => u.isActive).length})` : `Inactifs (${users.filter(u => !u.isActive).length})`}
            </button>
          ))}
        </div>
        {!showForm && (
          <Button size="sm" onClick={openCreate}>+ Nouvel utilisateur</Button>
        )}
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {editingUser ? `Modifier ${editingUser.firstName} ${editingUser.lastName}` : "Nouvel utilisateur"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rôle *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(ROLE_LABELS).map(([r, l]) => (
                      <option key={r} value={r}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {editingUser ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe *"}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="8 caractères minimum"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirmer</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={cancelForm}>Annuler</Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Enregistrement…" : editingUser ? "Mettre à jour" : "Créer le compte"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Modale réinitialisation mot de passe */}
      {resetUserId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Réinitialiser le mot de passe
              </h3>
              {resetSuccess ? (
                <p className="text-sm text-green-600">✅ Mot de passe modifié avec succès.</p>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Confirmer</label>
                    <input
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {resetError && <p className="text-sm text-red-600">{resetError}</p>}
                  <div className="flex gap-2 justify-end pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setResetUserId(null)}>Annuler</Button>
                    <Button type="submit" size="sm" disabled={resetSaving}>
                      {resetSaving ? "Modification…" : "Modifier le mot de passe"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div className="space-y-2">
        {displayed.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <Card key={u.id} className={`transition-shadow hover:shadow-sm ${!u.isActive ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Infos */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar initiales */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {u.firstName} {u.lastName}
                          {isSelf && <span className="text-xs text-gray-400 ml-1">(vous)</span>}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                        {!u.isActive && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Inactif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {u.email}
                        {u._count.responsibleMarkets > 0 && (
                          <span className="ml-2 text-gray-400">· {u._count.responsibleMarkets} marché(s)</span>
                        )}
                        <span className="ml-2 text-gray-300">
                          · Créé le {format(new Date(u.createdAt), "d MMM yyyy", { locale: fr })}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Modifier */}
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Réinitialiser MDP */}
                    <button
                      onClick={() => openReset(u.id)}
                      className="p-1.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                      title="Réinitialiser le mot de passe"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>

                    {/* Activer / Désactiver */}
                    {!isSelf && (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`p-1.5 rounded transition-colors ${u.isActive ? "text-gray-400 hover:text-yellow-600" : "text-gray-400 hover:text-green-600"}`}
                        title={u.isActive ? "Désactiver le compte" : "Réactiver le compte"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {u.isActive
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          }
                        </svg>
                      </button>
                    )}

                    {/* Supprimer */}
                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {displayed.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Aucun utilisateur dans cette catégorie.</p>
        )}
      </div>
    </div>
  );
}
