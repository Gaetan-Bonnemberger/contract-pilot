import { prisma } from "@/lib/prisma";
import type { AlertSeverity } from "@prisma/client";

interface AlertToCreate {
  marketId: string;
  projectId?: string;
  alertType: string;
  severity: AlertSeverity;
  cause: string;
  expectedAction: string;
}

// Recalcule toutes les alertes d'un marché
export async function recalculateAlerts(marketId: string): Promise<number> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      projects: {
        include: { documents: { include: { documentType: true } } },
      },
      kpis: true,
    },
  });

  if (!market) throw new Error("Marché introuvable");

  const alertsToCreate: AlertToCreate[] = [];
  const now = new Date();

  for (const project of market.projects) {
    // 1. Urgence hors délai
    if (project.isUrgent && project.isUrgentLate) {
      alertsToCreate.push({
        marketId,
        projectId: project.id,
        alertType: "URGENCE_HORS_DELAI",
        severity: "CRITIQUE",
        cause: `Intervention urgente sur ${project.siteName ?? project.projectCode} réalisée hors délai contractuel`,
        expectedAction: "Analyser cause racine, sécuriser astreinte et capacité urgences",
      });
    }

    // 2. Topo requis non remis
    if (project.topoRequired && !project.topoDelivered) {
      const daysSincePerformed = project.performedDate
        ? Math.floor(
            (now.getTime() - project.performedDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
      if (daysSincePerformed > 2) {
        alertsToCreate.push({
          marketId,
          projectId: project.id,
          alertType: "TOPO_MANQUANT",
          severity: "CRITIQUE",
          cause: `Topo photogrammétrique requis non remis sur ${project.siteName ?? project.projectCode} (${daysSincePerformed}j de retard)`,
          expectedAction: "Faire produire et transmettre le topo immédiatement",
        });
      }
    }

    // 3. AAT > 75 jours sans récupération touret
    if (
      project.drumInvolved &&
      !project.drumRecoveryRequestedAt &&
      project.aatDate
    ) {
      const daysSinceAat = Math.floor(
        (now.getTime() - project.aatDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceAat > 75) {
        alertsToCreate.push({
          marketId,
          projectId: project.id,
          alertType: "TOURET_NON_RECUPERE",
          severity: "MAJEUR",
          cause: `AAT signée depuis ${daysSinceAat}j sans reprise de touret sur ${project.siteName ?? project.projectCode}`,
          expectedAction: "Planifier la récupération du touret immédiatement",
        });
      }
    }

    // 4. Documents obligatoires manquants / en retard
    for (const doc of project.documents) {
      if (doc.isMandatory && !doc.receivedDate && doc.expectedDate) {
        const daysLate = Math.floor(
          (now.getTime() - doc.expectedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysLate > 0) {
          alertsToCreate.push({
            marketId,
            projectId: project.id,
            alertType: "DOCUMENT_MANQUANT",
            severity: daysLate > 7 ? "CRITIQUE" : "MAJEUR",
            cause: `${doc.documentType.name} manquant sur ${project.siteName ?? project.projectCode} (${daysLate}j de retard)`,
            expectedAction: "Obtenir et valider le document manquant",
          });
        }
      }
    }
  }

  // 5. Seuil sécurité
  const safetyKpi = market.kpis.find((k) => k.category === "Sécurité");
  if (safetyKpi?.currentValue && market.safetyThreshold) {
    if (Number(safetyKpi.currentValue) < Number(market.safetyThreshold)) {
      alertsToCreate.push({
        marketId,
        alertType: "NOTE_SECURITE_SOUS_SEUIL",
        severity: "CRITIQUE",
        cause: `Note sécurité ${safetyKpi.currentValue} inférieure au seuil contractuel ${market.safetyThreshold}`,
        expectedAction: "Déclencher plan d'action sécurité immédiat",
      });
    }
  }

  // 6. Seuil qualité
  const qualityKpi = market.kpis.find((k) => k.category === "Qualité");
  if (qualityKpi?.currentValue && market.qualityThreshold) {
    if (Number(qualityKpi.currentValue) < Number(market.qualityThreshold)) {
      alertsToCreate.push({
        marketId,
        alertType: "NOTE_QUALITE_SOUS_SEUIL",
        severity: "MAJEUR",
        cause: `Note qualité ${qualityKpi.currentValue} inférieure au seuil contractuel ${market.qualityThreshold}`,
        expectedAction: "Analyser causes de dégradation qualité et définir plan d'action",
      });
    }
  }

  // Fermer les alertes du même type déjà ouvertes avant de recréer
  // (évite doublons - on supprime et recrée)
  const alertTypes = [...new Set(alertsToCreate.map((a) => a.alertType))];

  if (alertTypes.length > 0) {
    await prisma.alert.updateMany({
      where: {
        marketId,
        alertType: { in: alertTypes },
        status: { not: "CLOSED" },
      },
      data: { status: "CLOSED", closedAt: now },
    });
  }

  // Créer les nouvelles alertes
  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({ data: alertsToCreate });
  }

  return alertsToCreate.length;
}
