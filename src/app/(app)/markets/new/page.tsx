"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Topbar } from "@/components/layout/topbar";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewMarketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="marketCode">Code marché *</Label>
                  <Input
                    id="marketCode"
                    name="marketCode"
                    value={form.marketCode}
                    onChange={handleChange}
                    placeholder="ECB2303550"
                    required
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
