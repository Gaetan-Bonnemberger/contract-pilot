import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Plus } from "@/components/icons";
import { scoreBgColor } from "@/lib/score";
import { PERMISSIONS } from "@/lib/permissions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  ARCHIVED: "Archivé",
  CLOSED: "Clôturé",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-800",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

export default async function MarketsPage() {
  const session = await auth();
  const role = session!.user.role;
  const canCreate = PERMISSIONS.markets.create(role);

  const markets = await prisma.market.findMany({
    include: {
      responsibleUser: true,
      alerts: { where: { status: { not: "CLOSED" } } },
      events: { where: { eventType: "PENALITE" } },
      scores: { orderBy: { calculatedAt: "desc" }, take: 1 },
      _count: { select: { projects: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Marchés"
        subtitle={`${markets.length} marché(s) enregistré(s)`}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/markets/new">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau marché
              </Link>
            </Button>
          ) : null
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Code
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Client
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Titre
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Alertes
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pénalités
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Chantiers
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Resp.
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Statut
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {markets.map((market) => {
                  const lastScore = market.scores[0];
                  const scoreVal = lastScore ? Number(lastScore.scoreValue) : null;
                  const alertCount = market.alerts.length;
                  const penalties = market.events.reduce(
                    (sum, e) => sum + Number(e.amountHt),
                    0
                  );

                  return (
                    <tr key={market.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium">
                        {market.marketCode}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{market.clientName}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {market.title}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                        {market.marketType}
                      </td>
                      <td className="px-4 py-3">
                        {scoreVal !== null ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${scoreBgColor(scoreVal)}`}
                          >
                            {scoreVal}/100
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {alertCount > 0 ? (
                          <span className="font-semibold text-red-600">{alertCount}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {penalties > 0
                          ? `${penalties.toLocaleString("fr-FR")} €`
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {market._count.projects}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {market.responsibleUser
                          ? `${market.responsibleUser.firstName} ${market.responsibleUser.lastName[0]}.`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[market.status]}`}
                        >
                          {STATUS_LABELS[market.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                          <Link href={`/markets/${market.id}/overview`}>
                            Ouvrir <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {markets.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                      Aucun marché.{" "}
                      {canCreate && (
                        <Link href="/markets/new" className="text-blue-600 hover:underline">
                          Créer le premier marché
                        </Link>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
