import {
  PrismaClient,
  UserRole,
  Criticality,
  MarketStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seed en cours...");

  // --- UTILISATEURS ---
  const hash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@comelec.local" },
    update: {},
    create: {
      firstName: "Gaetan",
      lastName: "Admin",
      email: "admin@comelec.local",
      passwordHash: hash,
      role: UserRole.ADMIN,
    },
  });

  const responsable = await prisma.user.upsert({
    where: { email: "marche@comelec.local" },
    update: {},
    create: {
      firstName: "Mickael",
      lastName: "Mena",
      email: "marche@comelec.local",
      passwordHash: hash,
      role: UserRole.RESPONSABLE_MARCHE,
    },
  });

  const qse = await prisma.user.upsert({
    where: { email: "qse@comelec.local" },
    update: {},
    create: {
      firstName: "Claire",
      lastName: "Martin",
      email: "qse@comelec.local",
      passwordHash: hash,
      role: UserRole.QSE,
    },
  });

  // --- RÉFÉRENCES KPI ---
  const kpiUrgence = await prisma.kpiReference.upsert({
    where: { kpiCode: "KPI_URG_001" },
    update: {},
    create: {
      kpiCode: "KPI_URG_001",
      name: "Taux de respect des urgences",
      category: "Délais",
      kpiType: "Contractuel",
      description:
        "Pourcentage d'interventions urgentes réalisées dans le délai contractuel.",
      formulaLogic: "(urgences_dans_delai / urgences_total) * 100",
      unit: "%",
      frequency: "Hebdo",
      defaultGreenThreshold: 100,
      defaultOrangeThreshold: 95,
      defaultRedThreshold: 90,
      ownerRole: "EXPLOITATION",
    },
  });

  const kpiTopo = await prisma.kpiReference.upsert({
    where: { kpiCode: "KPI_DOC_001" },
    update: {},
    create: {
      kpiCode: "KPI_DOC_001",
      name: "Taux de remise des topographies",
      category: "Conformité",
      kpiType: "Contractuel",
      description: "Pourcentage de topographies remises lorsque requises.",
      formulaLogic: "(topo_remis / topo_requis) * 100",
      unit: "%",
      frequency: "Mensuel",
      defaultGreenThreshold: 100,
      defaultOrangeThreshold: 95,
      defaultRedThreshold: 90,
      ownerRole: "RESPONSABLE_MARCHE",
    },
  });

  const kpiSec = await prisma.kpiReference.upsert({
    where: { kpiCode: "KPI_SEC_001" },
    update: {},
    create: {
      kpiCode: "KPI_SEC_001",
      name: "Note de sécurité",
      category: "Sécurité",
      kpiType: "Contractuel",
      description: "Note obtenue lors de la revue sécurité trimestrielle.",
      unit: "/20",
      frequency: "Trimestriel",
      defaultGreenThreshold: 18,
      defaultOrangeThreshold: 16,
      defaultRedThreshold: 14,
      ownerRole: "QSE",
    },
  });

  // --- RÉFÉRENCES CLAUSES ---
  const clauseUrgence = await prisma.clauseReference.upsert({
    where: { clauseCode: "CLAUSE_34_6_URGENCE" },
    update: {},
    create: {
      clauseCode: "CLAUSE_34_6_URGENCE",
      articleRef: "34.6",
      title: "Pénalité non-respect des délais d'intervention",
      family: "Délais",
      criticality: Criticality.CRITIQUE,
      impactType: "Pénalité",
      defaultEvidence: "Horodatage intervention / ordre d'exécution",
      defaultAlertType: "URGENCE_HORS_DELAI",
      defaultPenaltyFormula: "500 € par intervention hors délai",
    },
  });

  const clauseTopo = await prisma.clauseReference.upsert({
    where: { clauseCode: "CLAUSE_34_6_TOPO" },
    update: {},
    create: {
      clauseCode: "CLAUSE_34_6_TOPO",
      articleRef: "34.6",
      title: "Pénalité non-remise topo photogrammétrique",
      family: "Documents",
      criticality: Criticality.CRITIQUE,
      impactType: "Pénalité",
      defaultEvidence: "Topo validé et livré",
      defaultAlertType: "TOPO_MANQUANT",
      defaultPenaltyFormula: "4% de la commande",
    },
  });

  // --- TYPES DE DOCUMENTS ---
  const docAAT = await prisma.documentTypeReference.upsert({
    where: { docTypeCode: "DOC_AAT" },
    update: {},
    create: {
      docTypeCode: "DOC_AAT",
      name: "AAT",
      isMandatoryDefault: true,
      triggerCondition: "Fin de chantier",
      defaultDueDays: 0,
      criticality: Criticality.CRITIQUE,
      ownerRole: "EXPLOITATION",
    },
  });

  const docPAT = await prisma.documentTypeReference.upsert({
    where: { docTypeCode: "DOC_PAT" },
    update: {},
    create: {
      docTypeCode: "DOC_PAT",
      name: "PAT",
      isMandatoryDefault: true,
      triggerCondition: "Fin de chantier / réception",
      defaultDueDays: 2,
      criticality: Criticality.FORT,
      ownerRole: "EXPLOITATION",
    },
  });

  const docTOPO = await prisma.documentTypeReference.upsert({
    where: { docTypeCode: "DOC_TOPO" },
    update: {},
    create: {
      docTypeCode: "DOC_TOPO",
      name: "Topo photogrammétrique",
      isMandatoryDefault: false,
      triggerCondition: "Si commandé",
      defaultDueDays: 2,
      criticality: Criticality.CRITIQUE,
      ownerRole: "RESPONSABLE_MARCHE",
    },
  });

  // --- MODÈLE DE SCORE ---
  let scoreModel = await prisma.scoreModel.findFirst({
    where: { isDefault: true },
  });
  if (!scoreModel) {
    scoreModel = await prisma.scoreModel.create({
      data: {
        name: "Modèle standard contractuel",
        isDefault: true,
        lines: {
          create: [
            { metricCode: "DELAIS", label: "Délais", weight: 20, sortOrder: 1, greenRule: "≥95%", orangeRule: "80-95%", redRule: "<80%" },
            { metricCode: "SECURITE", label: "Sécurité", weight: 20, sortOrder: 2, greenRule: "≥16/20", orangeRule: "14-16", redRule: "<14" },
            { metricCode: "QUALITE", label: "Qualité", weight: 15, sortOrder: 3, greenRule: "≥16/20", orangeRule: "14-16", redRule: "<14" },
            { metricCode: "DOCUMENTS", label: "Documents", weight: 15, sortOrder: 4, greenRule: "≥95%", orangeRule: "80-95%", redRule: "<80%" },
            { metricCode: "RECEPTION", label: "Réception", weight: 10, sortOrder: 5, greenRule: "≥70%", orangeRule: "40-70%", redRule: "<40%" },
            { metricCode: "PENALITES", label: "Pénalités/Écarts", weight: 10, sortOrder: 6 },
            { metricCode: "ALERTES", label: "Alertes/Risques", weight: 5, sortOrder: 7 },
            { metricCode: "BONUS", label: "Bonus/Opportunités", weight: 5, sortOrder: 8 },
          ],
        },
      },
    });
  }

  // --- MARCHÉ EXEMPLE ---
  const market = await prisma.market.upsert({
    where: { marketCode: "ECB2303550" },
    update: {},
    create: {
      marketCode: "ECB2303550",
      title: "Marché-cadre TPE Aude Ouest",
      clientName: "Enedis",
      lotName: "Lot 6 Aude Ouest",
      marketType: "Travaux / Terrassements ponctuels électriques",
      status: MarketStatus.ACTIVE,
      startDate: new Date("2026-01-15"),
      endDate: new Date("2030-01-14"),
      firmAmountHt: 220000,
      optionAmountHt: 110000,
      renewalCount: 2,
      qualityThreshold: 16,
      safetyThreshold: 16,
      consumptionThresholdYear1: 60,
      consumptionThresholdNext: 80,
      receptionThresholdYear1: 40,
      receptionThresholdNext: 70,
      responsibleUserId: responsable.id,
      createdById: admin.id,
    },
  });

  // --- KPIs DU MARCHÉ ---
  const existingKpis = await prisma.marketKpi.findMany({
    where: { marketId: market.id },
  });
  if (existingKpis.length === 0) {
    await prisma.marketKpi.createMany({
      data: [
        {
          marketId: market.id,
          kpiReferenceId: kpiUrgence.id,
          kpiCode: "KPI_URG_001",
          name: "Taux de respect des urgences",
          category: "Délais",
          kpiType: "Contractuel",
          unit: "%",
          frequency: "Hebdo",
          greenThreshold: 100,
          orangeThreshold: 95,
          redThreshold: 90,
          currentValue: 50,
          targetValue: 100,
        },
        {
          marketId: market.id,
          kpiReferenceId: kpiTopo.id,
          kpiCode: "KPI_DOC_001",
          name: "Taux de remise des topographies",
          category: "Conformité",
          kpiType: "Contractuel",
          unit: "%",
          frequency: "Mensuel",
          greenThreshold: 100,
          orangeThreshold: 95,
          redThreshold: 90,
          currentValue: 50,
          targetValue: 100,
        },
        {
          marketId: market.id,
          kpiReferenceId: kpiSec.id,
          kpiCode: "KPI_SEC_001",
          name: "Note de sécurité",
          category: "Sécurité",
          kpiType: "Contractuel",
          unit: "/20",
          frequency: "Trimestriel",
          greenThreshold: 18,
          orangeThreshold: 16,
          redThreshold: 14,
          currentValue: 16.5,
          targetValue: 18,
        },
      ],
    });
  }

  // --- CLAUSES DU MARCHÉ ---
  const marketClauseUrgence = await prisma.marketClause.create({
    data: {
      marketId: market.id,
      clauseReferenceId: clauseUrgence.id,
      articleRef: "34.6",
      title: "Urgence hors délai — 500 €/intervention",
      description: "Pénalité de 500 € par intervention urgente réalisée hors délai contractuel.",
      criticality: Criticality.CRITIQUE,
      isContractual: true,
      requiresFollowUp: true,
    },
  });

  const marketClauseTopo = await prisma.marketClause.create({
    data: {
      marketId: market.id,
      clauseReferenceId: clauseTopo.id,
      articleRef: "34.6",
      title: "Topo photogrammétrique non remis — 4%",
      description: "Pénalité de 4% de la valeur de la commande si topo requis non livré.",
      criticality: Criticality.CRITIQUE,
      isContractual: true,
      requiresFollowUp: true,
    },
  });

  // --- OBLIGATIONS ---
  const existingObs = await prisma.marketObligation.findMany({
    where: { marketId: market.id },
  });
  if (existingObs.length === 0) {
    await prisma.marketObligation.createMany({
      data: [
        {
          marketId: market.id,
          clauseId: marketClauseUrgence.id,
          title: "Respecter les délais d'intervention en urgence",
          description: "Toute intervention urgente doit être réalisée dans le délai contractuel.",
          category: "Délais",
          criticality: Criticality.CRITIQUE,
          frequency: "Chaque intervention",
          triggerCondition: "Commande urgente",
          expectedEvidence: "Horodatage de l'ordre et de la réalisation",
          dueRule: "Immédiat",
          ownerUserId: responsable.id,
        },
        {
          marketId: market.id,
          clauseId: marketClauseTopo.id,
          title: "Remettre le topo photogrammétrique lorsqu'il est commandé",
          description: "Le topo doit être livré lorsqu'il est demandé par Enedis.",
          category: "Documents",
          criticality: Criticality.CRITIQUE,
          frequency: "Chaque chantier concerné",
          triggerCondition: "Topo requis",
          expectedEvidence: "Fichier topo + validation",
          dueRule: "Sous 2 jours après réalisation",
          ownerUserId: responsable.id,
        },
      ],
    });
  }

  // --- CHANTIERS ---
  const existingProjects = await prisma.project.findMany({
    where: { marketId: market.id },
  });

  let project1: { id: string };
  let project2: { id: string };

  if (existingProjects.length === 0) {
    project1 = await prisma.project.create({
      data: {
        marketId: market.id,
        projectCode: "CH-0001",
        orderNumber: "CMD-2026-001",
        siteName: "Carcassonne Nord",
        zoneName: "Aude Ouest",
        plannedDate: new Date("2026-02-12"),
        performedDate: new Date("2026-02-12"),
        receptionDate: new Date("2026-02-14"),
        isUrgent: true,
        isUrgentLate: false,
        topoRequired: true,
        topoDelivered: true,
        aatSigned: true,
        aatDate: new Date("2026-02-14"),
        patReceived: true,
        drumInvolved: true,
        drumRecoveryRequestedAt: new Date("2026-03-01"),
        orderedAmountHt: 4200,
        performedAmountHt: 4200,
        receivedAmountHt: 4200,
        status: "RECEPTIONNE",
      },
    });

    project2 = await prisma.project.create({
      data: {
        marketId: market.id,
        projectCode: "CH-0002",
        orderNumber: "CMD-2026-002",
        siteName: "Limoux",
        zoneName: "Aude Ouest",
        plannedDate: new Date("2026-02-18"),
        performedDate: new Date("2026-02-19"),
        isUrgent: true,
        isUrgentLate: true,
        topoRequired: true,
        topoDelivered: false,
        aatSigned: true,
        aatDate: new Date("2026-02-20"),
        patReceived: false,
        drumInvolved: true,
        orderedAmountHt: 3100,
        performedAmountHt: 3100,
        receivedAmountHt: 0,
        status: "EN_COURS",
      },
    });

    // --- DOCUMENTS CHANTIER ---
    await prisma.projectDocument.createMany({
      data: [
        {
          marketId: market.id,
          projectId: project1.id,
          documentTypeId: docAAT.id,
          isMandatory: true,
          expectedDate: new Date("2026-02-14"),
          receivedDate: new Date("2026-02-14"),
          isValid: true,
        },
        {
          marketId: market.id,
          projectId: project1.id,
          documentTypeId: docPAT.id,
          isMandatory: true,
          expectedDate: new Date("2026-02-16"),
          receivedDate: new Date("2026-02-15"),
          isValid: true,
        },
        {
          marketId: market.id,
          projectId: project2.id,
          documentTypeId: docTOPO.id,
          isMandatory: true,
          expectedDate: new Date("2026-02-22"),
          receivedDate: null,
          isValid: false,
          lateDays: 8,
          comments: "Topo non remis à date",
        },
      ],
    });

    // --- ÉVÉNEMENTS ---
    await prisma.marketEvent.createMany({
      data: [
        {
          marketId: market.id,
          projectId: project2.id,
          eventType: "PENALITE",
          eventSubtype: "URGENCE_HORS_DELAI",
          eventDate: new Date("2026-02-19"),
          articleRef: "34.6",
          amountHt: 500,
          rootCause: "Problème de planification et équipe indisponible",
          responsibility: "Titulaire",
          correctiveAction: "Créer une réserve de capacité pour urgences",
        },
        {
          marketId: market.id,
          projectId: project2.id,
          eventType: "PENALITE",
          eventSubtype: "TOPO_NON_REMIS",
          eventDate: new Date("2026-02-28"),
          articleRef: "34.6",
          amountHt: 124,
          rootCause: "Transmission documentaire non faite",
          responsibility: "Titulaire",
          correctiveAction: "Check-list de clôture chantier",
        },
        {
          marketId: market.id,
          projectId: project1.id,
          eventType: "BONUS",
          eventSubtype: "SITUATION_DANGEREUSE_REMONTÉE",
          eventDate: new Date("2026-02-12"),
          articleRef: "23.4",
          amountHt: 100,
          rootCause: "NA",
          responsibility: "Titulaire",
          correctiveAction: "Continuer remontées sécurité terrain",
        },
      ],
    });

    // --- ALERTES ---
    await prisma.alert.createMany({
      data: [
        {
          marketId: market.id,
          projectId: project2.id,
          alertType: "URGENCE_HORS_DELAI",
          severity: "CRITIQUE",
          cause: "Intervention urgente réalisée hors délai",
          responsibleUserId: responsable.id,
          expectedAction: "Analyser cause racine et sécuriser astreinte",
        },
        {
          marketId: market.id,
          projectId: project2.id,
          alertType: "TOPO_MANQUANT",
          severity: "CRITIQUE",
          cause: "Topo requis non remis",
          responsibleUserId: responsable.id,
          expectedAction: "Faire produire et transmettre le topo immédiatement",
        },
      ],
    });

    // --- ACTIONS ---
    await prisma.actionPlan.createMany({
      data: [
        {
          marketId: market.id,
          title: "Créer une check-list de clôture chantier",
          description: "Bloquer la clôture si AAT/PAT/topo manquent.",
          priority: "1",
          category: "Conformité documentaire",
          riskCovered: "Pénalités documentaires",
          responsibleUserId: responsable.id,
          expectedResult: "Réduction des topographies et PAT manquants",
          targetDate: new Date("2026-03-31"),
        },
        {
          marketId: market.id,
          title: "Mettre en place une astreinte sécurisée urgences",
          description: "Capacité dédiée pour urgences et remplacement.",
          priority: "1",
          category: "Délais",
          riskCovered: "Urgence hors délai",
          responsibleUserId: responsable.id,
          expectedResult: "100% des urgences dans le délai",
          targetDate: new Date("2026-03-15"),
        },
      ],
    });
  } else {
    project1 = existingProjects[0];
    project2 = existingProjects[1] ?? existingProjects[0];
  }

  console.log("✅ Seed terminé");
  console.log("   admin@comelec.local  / password123  (ADMIN)");
  console.log("   marche@comelec.local / password123  (RESPONSABLE_MARCHE)");
  console.log("   qse@comelec.local    / password123  (QSE)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
