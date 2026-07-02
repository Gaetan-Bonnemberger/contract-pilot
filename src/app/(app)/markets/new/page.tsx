"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Topbar } from "@/components/layout/topbar";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { detectMarketDocType, type MarketDocType } from "@/lib/market-doc-type";
import { mergePrefills, type PrefillResult } from "@/app/api/markets/prefill/prefill-mapping";

type FileStatus = { name: string; docType: MarketDocType; status: "pending" | "running" | "ok" | "skipped" };

const DOC_TYPE_LABELS: Record<MarketDocType, string> = {
  ccap: "CCAP", cctp: "CCTP", rc: "RC", ae: "Acte d'engagement", bpu: "BPU", dqe: "DQE", unknown: "Document",
};
const STATUS_ICON: Record<FileStatus["status"], string> = { pending: "⏳", running: "🔄", ok: "✅", skipped: "⏭️" };
const STATUS_LABEL: Record<FileStatus["status"], string> = { pending: "en attente", running: "en cours…", ok: "ok", skipped: "ignoré" };

export default function NewMarketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    marketCode: "",
    title: "",
    clientName: "",
    lotName: "",
    marketType: "",
    startDate: "",
    endDate: "",
    firmAmountHt: "",
    optionAmountHt: "",
    renewalCount: "0",
    qualityThreshold: "16",
    safetyThreshold: "16",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function analyzeOne(file: File): Promise<PrefillResult | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/markets/prefill", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? `Échec de l'analyse de ${file.name}`);
      return null;
    }
    if (data.extractedChars === 0 || !data.prefill) return null; // scanné / vide → ignoré
    return { docType: data.docType as MarketDocType, prefill: data.prefill };
  }

  async function handlePrefillFiles(fileList: File[]) {
    if (prefilling || fileList.length === 0) return;
    setPrefilling(true);
    const statuses: FileStatus[] = fileList.map((f) => ({
      name: f.name, docType: detectMarketDocType(f.name), status: "pending",
    }));
    setFileStatuses(statuses);

    const results: PrefillResult[] = [];
    for (let i = 0; i < fileList.length; i++) {          // SÉQUENTIEL (un seul modèle Ollama)
      const f = fileList[i];
      const dt = statuses[i].docType;
      setProgress({ current: i + 1, total: fileList.length, label: dt !== "unknown" ? DOC_TYPE_LABELS[dt] : f.name });
      setFileStatuses((prev) => prev.map((s, j) => (j === i ? { ...s, status: "running" } : s)));

      let result: PrefillResult | null = null;
      try { result = await analyzeOne(f); } catch { result = null; }  // un échec n'interrompt pas la série
      if (result) results.push(result);
      setFileStatuses((prev) => prev.map((s, j) => (j === i ? { ...s, status: result ? "ok" : "skipped" } : s)));
    }

    setProgress(null);
    setPrefilling(false);

    if (results.length === 0) {
      toast.warning("Aucun document exploitable (scannés ou en échec). Remplissez le formulaire manuellement.");
      return;
    }

    const merged = mergePrefills(results);
    setForm((prev) => ({
      ...prev,
      marketCode:     merged.marketCode   || prev.marketCode,
      clientName:     merged.clientName   || prev.clientName,
      title:          merged.title        || prev.title,
      lotName:        merged.lotName       || prev.lotName,
      marketType:     merged.marketType   || prev.marketType,
      firmAmountHt:   merged.firmAmountHt   != null ? String(merged.firmAmountHt)   : prev.firmAmountHt,
      optionAmountHt: merged.optionAmountHt != null ? String(merged.optionAmountHt) : prev.optionAmountHt,
      renewalCount:   merged.renewalCount   != null ? String(merged.renewalCount)   : prev.renewalCount,
    }));
    toast.success(`${results.length} document(s) analysé(s) — formulaire pré-rempli, vérifiez avant de créer.`);
    // Amène les champs pré-remplis + le bouton « Créer le marché » à l'écran.
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (prefilling) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) handlePrefillFiles(files);
  }, [prefilling]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          firmAmountHt: form.firmAmountHt ? parseFloat(form.firmAmountHt) : undefined,
          optionAmountHt: form.optionAmountHt ? parseFloat(form.optionAmountHt) : undefined,
          renewalCount: parseInt(form.renewalCount) || 0,
          qualityThreshold: form.qualityThreshold ? parseFloat(form.qualityThreshold) : undefined,
          safetyThreshold: form.safetyThreshold ? parseFloat(form.safetyThreshold) : undefined,
        }),
      });

      if (res.ok) {
        const market = await res.json();
        toast.success("Marché créé avec succès");
        router.push(`/markets/${market.id}/overview`);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Nouveau marché"
        subtitle="Créer un nouveau marché contractuel"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href="/markets">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour aux marchés
            </Link>
          </Button>

          {/* ── Pré-remplissage IA par dépôt de document ─────────────────── */}
          <Card className="mb-6 border-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Pré-remplir depuis un document (facultatif)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  prefilling
                    ? "opacity-60 cursor-not-allowed border-gray-200 bg-gray-50"
                    : dragging
                    ? "border-blue-400 bg-blue-50"
                    : fileStatuses.length > 0
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
                }`}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); if (!prefilling) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => !prefilling && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.docx,.doc,.xlsx,.xls"
                  className="hidden"
                  disabled={prefilling}
                  onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) handlePrefillFiles(fs); }}
                />
                {prefilling ? (
                  <div className="space-y-1">
                    <div className="text-2xl animate-pulse">🤖</div>
                    <p className="text-sm font-medium text-blue-700">Analyse séquentielle en cours…</p>
                    <p className="text-xs text-gray-400">
                      Un document à la fois (modèle local). 10 à 30 s par pièce au premier appel.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl text-gray-300">📁</div>
                    <p className="text-sm font-medium text-gray-600">
                      Glissez-déposez les pièces du dossier (CCAP, CCTP, AE, BPU, DQE…)
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF, Word, Excel ou TXT — plusieurs fichiers acceptés. Vous validez ensuite chaque champ.
                    </p>
                  </div>
                )}
              </div>

              {progress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Analyse {progress.current}/{progress.total} : {progress.label}…</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {fileStatuses.length > 0 && (
                <ul className="space-y-1">
                  {fileStatuses.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span>{STATUS_ICON[s.status]}</span>
                      <span className="font-medium text-gray-700 truncate max-w-[220px]">{s.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{DOC_TYPE_LABELS[s.docType]}</span>
                      <span className="ml-auto text-gray-400">{STATUS_LABEL[s.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="marketCode">Code marché</Label>
                  <Input
                    id="marketCode"
                    name="marketCode"
                    value={form.marketCode}
                    onChange={handleChange}
                    placeholder="ECB2303550"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clientName">Client *</Label>
                  <Input
                    id="clientName"
                    name="clientName"
                    value={form.clientName}
                    onChange={handleChange}
                    placeholder="Enedis"
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="title">Titre du marché *</Label>
                  <Input
                    id="title"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Marché-cadre TPE Aude Ouest"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lotName">Lot / Zone</Label>
                  <Input
                    id="lotName"
                    name="lotName"
                    value={form.lotName}
                    onChange={handleChange}
                    placeholder="Lot 6 Aude Ouest"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="marketType">Type de marché *</Label>
                  <Input
                    id="marketType"
                    name="marketType"
                    value={form.marketType}
                    onChange={handleChange}
                    placeholder="Travaux / Terrassements ponctuels"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Durée et montants</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="startDate">Date de début</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="firmAmountHt">Montant ferme HT (€)</Label>
                  <Input
                    id="firmAmountHt"
                    name="firmAmountHt"
                    type="number"
                    value={form.firmAmountHt}
                    onChange={handleChange}
                    placeholder="220000"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="optionAmountHt">Montant options HT (€)</Label>
                  <Input
                    id="optionAmountHt"
                    name="optionAmountHt"
                    type="number"
                    value={form.optionAmountHt}
                    onChange={handleChange}
                    placeholder="110000"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="renewalCount">Nombre de reconductions</Label>
                  <Input
                    id="renewalCount"
                    name="renewalCount"
                    type="number"
                    value={form.renewalCount}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Seuils contractuels</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="qualityThreshold">Seuil qualité (/20)</Label>
                  <Input
                    id="qualityThreshold"
                    name="qualityThreshold"
                    type="number"
                    value={form.qualityThreshold}
                    onChange={handleChange}
                    min="0"
                    max="20"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="safetyThreshold">Seuil sécurité (/20)</Label>
                  <Input
                    id="safetyThreshold"
                    name="safetyThreshold"
                    type="number"
                    value={form.safetyThreshold}
                    onChange={handleChange}
                    min="0"
                    max="20"
                    step="0.1"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button asChild variant="outline">
                <Link href="/markets">Annuler</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Création..." : "Créer le marché"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
