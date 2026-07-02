import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { marketCodeLabel } from "@/lib/market-code";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { marketId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "excel";

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      responsibleUser: true,
      projects: {
        include: { events: true, alerts: true },
      },
      kpis: true,
      clauses: true,
      obligations: true,
      alerts: { where: { status: { not: "CLOSED" } } },
      actions: { include: { responsibleUser: true } },
      events: true,
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });
  }

  if (type === "excel") {
    const wb = XLSX.utils.book_new();

    // Onglet Marché
    const marketData = [
      ["Code", marketCodeLabel(market.marketCode)],
      ["Titre", market.title],
      ["Client", market.clientName],
      ["Lot", market.lotName ?? ""],
      ["Type", market.marketType],
      ["Statut", market.status],
      ["Début", market.startDate?.toLocaleDateString("fr-FR") ?? ""],
      ["Fin", market.endDate?.toLocaleDateString("fr-FR") ?? ""],
      ["Montant ferme HT", Number(market.firmAmountHt ?? 0)],
      ["Montant options HT", Number(market.optionAmountHt ?? 0)],
    ];
    const wsMarket = XLSX.utils.aoa_to_sheet(marketData);
    XLSX.utils.book_append_sheet(wb, wsMarket, "Marché");

    // Onglet Chantiers
    const projectHeaders = [
      "Code",
      "Commande",
      "Site",
      "Zone",
      "Planifié",
      "Réalisé",
      "Urgent",
      "Retard",
      "AAT",
      "PAT",
      "Topo requis",
      "Topo remis",
      "Touret",
      "Montant commandé HT",
      "Montant réalisé HT",
      "Montant réceptionné HT",
      "Statut",
      "Pénalités HT",
    ];
    const projectRows = market.projects.map((p) => [
      p.projectCode,
      p.orderNumber ?? "",
      p.siteName ?? "",
      p.zoneName ?? "",
      p.plannedDate?.toLocaleDateString("fr-FR") ?? "",
      p.performedDate?.toLocaleDateString("fr-FR") ?? "",
      p.isUrgent ? "Oui" : "Non",
      p.isUrgentLate ? "Oui" : "Non",
      p.aatSigned ? "Oui" : "Non",
      p.patReceived ? "Oui" : "Non",
      p.topoRequired ? "Oui" : "Non",
      p.topoDelivered ? "Oui" : "Non",
      p.drumInvolved ? "Oui" : "Non",
      Number(p.orderedAmountHt),
      Number(p.performedAmountHt),
      Number(p.receivedAmountHt),
      p.status,
      p.events
        .filter((e) => e.eventType === "PENALITE")
        .reduce((s, e) => s + Number(e.amountHt), 0),
    ]);
    const wsProjects = XLSX.utils.aoa_to_sheet([projectHeaders, ...projectRows]);
    XLSX.utils.book_append_sheet(wb, wsProjects, "Chantiers");

    // Onglet Alertes
    const alertHeaders = ["Type", "Gravité", "Statut", "Cause", "Action attendue", "Détectée le"];
    const alertRows = market.alerts.map((a) => [
      a.alertType,
      a.severity,
      a.status,
      a.cause ?? "",
      a.expectedAction ?? "",
      a.detectedAt.toLocaleDateString("fr-FR"),
    ]);
    const wsAlerts = XLSX.utils.aoa_to_sheet([alertHeaders, ...alertRows]);
    XLSX.utils.book_append_sheet(wb, wsAlerts, "Alertes");

    // Onglet Événements
    const eventHeaders = ["Type", "Sous-type", "Date", "Article", "Montant HT", "Cause", "Responsabilité", "Action corrective"];
    const eventRows = market.events.map((e) => [
      e.eventType,
      e.eventSubtype,
      e.eventDate.toLocaleDateString("fr-FR"),
      e.articleRef ?? "",
      Number(e.amountHt),
      e.rootCause ?? "",
      e.responsibility ?? "",
      e.correctiveAction ?? "",
    ]);
    const wsEvents = XLSX.utils.aoa_to_sheet([eventHeaders, ...eventRows]);
    XLSX.utils.book_append_sheet(wb, wsEvents, "Événements");

    // Onglet KPIs
    const kpiHeaders = ["Code", "Nom", "Catégorie", "Type", "Valeur actuelle", "Cible", "Seuil vert", "Seuil orange", "Seuil rouge", "Unité"];
    const kpiRows = market.kpis.map((k) => [
      k.kpiCode,
      k.name,
      k.category,
      k.kpiType,
      Number(k.currentValue ?? 0),
      Number(k.targetValue ?? 0),
      Number(k.greenThreshold ?? 0),
      Number(k.orangeThreshold ?? 0),
      Number(k.redThreshold ?? 0),
      k.unit ?? "",
    ]);
    const wsKpis = XLSX.utils.aoa_to_sheet([kpiHeaders, ...kpiRows]);
    XLSX.utils.book_append_sheet(wb, wsKpis, "KPIs");

    // Onglet Actions
    const actionHeaders = ["Priorité", "Titre", "Catégorie", "Risque couvert", "Responsable", "Échéance", "Résultat attendu", "Statut"];
    const actionRows = market.actions.map((a) => [
      a.priority,
      a.title,
      a.category ?? "",
      a.riskCovered ?? "",
      a.responsibleUser
        ? `${a.responsibleUser.firstName} ${a.responsibleUser.lastName}`
        : "",
      a.targetDate?.toLocaleDateString("fr-FR") ?? "",
      a.expectedResult ?? "",
      a.status,
    ]);
    const wsActions = XLSX.utils.aoa_to_sheet([actionHeaders, ...actionRows]);
    XLSX.utils.book_append_sheet(wb, wsActions, "Actions");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="marche-${market.marketCode ?? "sans-code"}.xlsx"`,
      },
    });
  }

  // PDF basique
  const text = `
CONTRACT PILOT — SYNTHÈSE MARCHÉ
=================================
Code: ${marketCodeLabel(market.marketCode)}
Titre: ${market.title}
Client: ${market.clientName}
Statut: ${market.status}

ALERTES OUVERTES: ${market.alerts.length}
PÉNALITÉS CUMULÉES: ${market.events.filter((e) => e.eventType === "PENALITE").reduce((s, e) => s + Number(e.amountHt), 0).toLocaleString("fr-FR")} €

ACTIONS EN COURS: ${market.actions.filter((a) => a.status !== "DONE").length}
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="synthese-${market.marketCode ?? "sans-code"}.txt"`,
    },
  });
}
