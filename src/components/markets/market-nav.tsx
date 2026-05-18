"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-800",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  ARCHIVED: "Archivé",
  CLOSED: "Clôturé",
};

interface MarketNavProps {
  market: {
    id: string;
    marketCode: string;
    title: string;
    clientName: string;
    status: string;
  };
}

const tabs = [
  { segment: "overview", label: "Vue d'ensemble" },
  { segment: "analysis", label: "Analyse IA" },
  { segment: "clauses", label: "Clauses" },
  { segment: "kpis", label: "KPI" },
  { segment: "obligations", label: "Obligations" },
  { segment: "projects", label: "Chantiers" },
  { segment: "documents", label: "Documents" },
  { segment: "alerts", label: "Alertes" },
  { segment: "actions", label: "Actions" },
  { segment: "avenants", label: "Avenants" },
  { segment: "nc", label: "NC QHSE" },
  { segment: "scoring", label: "Scoring" },
  { segment: "scores", label: "Historique scores" },
  { segment: "defense", label: "Défense" },
  { segment: "exports", label: "Exports" },
  { segment: "history", label: "Historique" },
];

export function MarketNav({ market }: MarketNavProps) {
  const pathname = usePathname();
  const base = `/markets/${market.id}`;

  return (
    <div className="bg-white border-b border-gray-200 flex-shrink-0">
      {/* Header */}
      <div className="px-6 pt-4 pb-0 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm" className="h-7 mt-0.5">
            <Link href="/markets">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Marchés
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-blue-700 font-medium">
                {market.marketCode}
              </span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[market.status]}`}
              >
                {STATUS_LABELS[market.status]}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              {market.title}
            </h2>
            <p className="text-xs text-gray-500">{market.clientName}</p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <nav className="flex gap-0 px-6 mt-3 overflow-x-auto">
        {tabs.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname.includes(`/${tab.segment}`);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-blue-600 text-blue-700 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
