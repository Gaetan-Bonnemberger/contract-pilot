"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Table, Download } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";

export default function ExportsPage() {
  const params = useParams();
  const marketId = params.marketId as string;

  async function handleExport(type: string) {
    toast.info(`Export ${type} en cours...`);
    try {
      const res = await fetch(`/api/markets/${marketId}/exports?type=${type}`);
      if (res.ok) {
        const blob = await res.blob();
        const ext = type === "excel" ? "xlsx" : "pdf";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `marche-${marketId}-${type}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export téléchargé");
      } else {
        toast.error("Erreur lors de l'export");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <p className="text-sm text-gray-500">Exporter les données du marché dans différents formats.</p>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Table className="h-4 w-4 text-green-600" />
              Export Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Exporte l'ensemble des données : chantiers, documents, alertes, événements, KPIs et obligations dans un classeur Excel multi-onglets.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-green-500 text-green-700 hover:bg-green-50"
              onClick={() => handleExport("excel")}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-600" />
              Synthèse PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Génère une synthèse PDF de la santé du marché : score, alertes critiques, KPIs et plan d'action. Format adapté aux revues de contrat.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-red-400 text-red-700 hover:bg-red-50"
              onClick={() => handleExport("pdf")}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
