import {
  PrismaClient,
  UserRole,
  Criticality,
  MarketStatus,
  NcType,
  NcSeverity,
  NcStatus,
  AlertSeverity,
  ActionStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("🌱 Seed enrichi en cours...");

  // ── UTILISATEURS ─────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@comelec.local" },
    update: {},
    create: {
      firstName: "Gaetan",
      lastName: "Bonnemberger",
      email: "admin@comelec.local",
      passwordHash: hash,
      role: UserRole.ADMIN,
    },
  });

  const mickael = await prisma.user.upsert({
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

  const claire = await prisma.user.upsert({
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

  const directeur = await prisma.user.upsert({
    where: { email: "direction@comelec.local" },
    update: {},
    create: {
      firstName: "Philippe",
      lastName: "Dupont",
      email: "direction@comelec.local",
      passwordHash: hash,
      role: UserRole.DIRECTEUR,
    },
  });

  // ── RÉFÉRENCES KPI ────────────────────────────────────────────────────────────
  const kpiUrgence = await prisma.kpiReference.upsert({
    where: { kpiCode: "KPI_URG_001" },
    update: {},
    create: {
      kpiCode: "KPI_URG_001",
      name: "Taux de respect des urgences",
      category: "Délais",
      kpiType: "Contractuel",
      description: "Pourcentage d'interventions urgentes réalisées dans le délai contractuel.",
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

  // ── RÉFÉRENCES CLAUSES ────────────────────────────────────────────────────────
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

  // ── TYPES DE DOCUMENTS ────────────────────────────────────────────────────────
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

  await prisma.documentTypeReference.upsert({
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

  // ── MODÈLE DE SCORE ───────────────────────────────────────────────────────────
  let scoreModel = await prisma.scoreModel.findFirst({ where: { isDefault: true } });
  if (!scoreModel) {
    scoreModel = await prisma.scoreModel.create({
      data: {
        name: "Modèle standard contractuel",
        isDefault: true,
        lines: {
          create: [
            { metricCode: "DELAIS",    label: "Délais",             weight: 20, sortOrder: 1, greenRule: "≥95%",    orangeRule: "80-95%", redRule: "<80%" },
            { metricCode: "SECURITE",  label: "Sécurité",           weight: 20, sortOrder: 2, greenRule: "≥16/20",  orangeRule: "14-16",  redRule: "<14" },
            { metricCode: "QUALITE",   label: "Qualité",            weight: 15, sortOrder: 3, greenRule: "≥16/20",  orangeRule: "14-16",  redRule: "<14" },
            { metricCode: "DOCUMENTS", label: "Documents",          weight: 15, sortOrder: 4, greenRule: "≥95%",    orangeRule: "80-95%", redRule: "<80%" },
            { metricCode: "RECEPTION", label: "Réception",          weight: 10, sortOrder: 5, greenRule: "≥70%",    orangeRule: "40-70%", redRule: "<40%" },
            { metricCode: "PENALITES", label: "Pénalités/Écarts",   weight: 10, sortOrder: 6 },
            { metricCode: "ALERTES",   label: "Alertes/Risques",    weight:  5, sortOrder: 7 },
            { metricCode: "BONUS",     label: "Bonus/Opportunités", weight:  5, sortOrder: 8 },
          ],
        },
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MARCHÉS
  // ══════════════════════════════════════════════════════════════════════════════

  // ── MARCHÉ 1 : Enedis Aude Ouest — score moyen (72) ──────────────────────────
  const m1 = await prisma.market.upsert({
    where: { marketCode: "ECB2303550" },
    update: {},
    create: {
      marketCode: "ECB2303550",
      title: "Marché-cadre TPE Aude Ouest",
      clientName: "Enedis",
      lotName: "Lot 6 — Aude Ouest",
      marketType: "Travaux / Terrassements ponctuels électriques",
      status: MarketStatus.ACTIVE,
      startDate: new Date("2026-01-15"),
      endDate:   new Date("2030-01-14"),
      firmAmountHt: 220000,
      optionAmountHt: 110000,
      renewalCount: 2,
      qualityThreshold: 16,
      safetyThreshold: 16,
      consumptionThresholdYear1: 60,
      consumptionThresholdNext: 80,
      receptionThresholdYear1: 40,
      receptionThresholdNext: 70,
      responsibleUserId: mickael.id,
      createdById: admin.id,
    },
  });

  // ── MARCHÉ 2 : Enedis Hérault — score critique (41) ──────────────────────────
  const m2 = await prisma.market.upsert({
    where: { marketCode: "ECB2303720" },
    update: {},
    create: {
      marketCode: "ECB2303720",
      title: "Marché BT Hérault Centre",
      clientName: "Enedis",
      lotName: "Lot 3 — Hérault Centre",
      marketType: "Travaux BT / Branchements",
      status: MarketStatus.ACTIVE,
      startDate: new Date("2025-09-01"),
      endDate:   new Date("2029-08-31"),
      firmAmountHt: 380000,
      optionAmountHt: 190000,
      renewalCount: 1,
      qualityThreshold: 15,
      safetyThreshold: 16,
      consumptionThresholdYear1: 50,
      consumptionThresholdNext: 75,
      receptionThresholdYear1: 35,
      receptionThresholdNext: 65,
      responsibleUserId: mickael.id,
      createdById: admin.id,
    },
  });

  // ── MARCHÉ 3 : GRDF Occitanie — excellent score (91) ─────────────────────────
  const m3 = await prisma.market.upsert({
    where: { marketCode: "GDF2404100" },
    update: {},
    create: {
      marketCode: "GDF2404100",
      title: "Renouvellement réseau gaz Occitanie",
      clientName: "GRDF",
      lotName: "Lot 1 — Languedoc Est",
      marketType: "Travaux / Renouvellement réseau gaz",
      status: MarketStatus.ACTIVE,
      startDate: new Date("2024-04-01"),
      endDate:   new Date("2027-03-31"),
      firmAmountHt: 650000,
      optionAmountHt: 120000,
      renewalCount: 0,
      qualityThreshold: 16,
      safetyThreshold: 17,
      consumptionThresholdYear1: 70,
      consumptionThresholdNext: 85,
      receptionThresholdYear1: 60,
      receptionThresholdNext: 75,
      responsibleUserId: mickael.id,
      createdById: admin.id,
    },
  });

  // ── MARCHÉ 4 : Ville de Montpellier — score moyen (67) ───────────────────────
  const m4 = await prisma.market.upsert({
    where: { marketCode: "VDM2502010" },
    update: {},
    create: {
      marketCode: "VDM2502010",
      title: "Éclairage public — Montpellier Nord",
      clientName: "Ville de Montpellier",
      lotName: "Secteur Nord",
      marketType: "Travaux / Éclairage public",
      status: MarketStatus.ACTIVE,
      startDate: new Date("2025-03-01"),
      endDate:   new Date("2028-02-28"),
      firmAmountHt: 175000,
      optionAmountHt: 50000,
      renewalCount: 1,
      qualityThreshold: 14,
      safetyThreshold: 15,
      consumptionThresholdYear1: 55,
      consumptionThresholdNext: 75,
      receptionThresholdYear1: 45,
      receptionThresholdNext: 65,
      responsibleUserId: mickael.id,
      createdById: admin.id,
    },
  });

  // ── MARCHÉ 5 : SNCF — clôturé, bon score (85) ────────────────────────────────
  const m5 = await prisma.market.upsert({
    where: { marketCode: "SNC2201300" },
    update: {},
    create: {
      marketCode: "SNC2201300",
      title: "Câblage signalisation ferroviaire",
      clientName: "SNCF Réseau",
      lotName: "Nîmes — Montpellier",
      marketType: "Travaux / Signalisation",
      status: MarketStatus.CLOSED,
      startDate: new Date("2022-01-10"),
      endDate:   new Date("2025-12-31"),
      firmAmountHt: 490000,
      optionAmountHt: 0,
      renewalCount: 0,
      qualityThreshold: 15,
      safetyThreshold: 16,
      consumptionThresholdYear1: 65,
      consumptionThresholdNext: 80,
      receptionThresholdYear1: 55,
      receptionThresholdNext: 75,
      responsibleUserId: mickael.id,
      createdById: admin.id,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // HISTORIQUE DES SCORES (pour les graphiques)
  // ══════════════════════════════════════════════════════════════════════════════
  async function seedScores(
    marketId: string,
    modelId: string,
    series: Array<{ daysAgo: number; score: number }>
  ) {
    await prisma.marketScore.createMany({
      data: series.map((pt) => {
        const d = new Date();
        d.setDate(d.getDate() - pt.daysAgo);
        return {
          marketId,
          scoreModelId: modelId,
          scoreValue: pt.score,
          scoreLabel: pt.score >= 80 ? "BON" : pt.score >= 60 ? "MOYEN" : "FAIBLE",
          calculatedAt: d,
          details: {},
        };
      }),
    });
  }

  // M1 : légère amélioration de 65 → 72
  await seedScores(m1.id, scoreModel.id, [
    { daysAgo: 90, score: 65 }, { daysAgo: 80, score: 67 }, { daysAgo: 70, score: 64 },
    { daysAgo: 60, score: 68 }, { daysAgo: 50, score: 70 }, { daysAgo: 40, score: 69 },
    { daysAgo: 30, score: 71 }, { daysAgo: 20, score: 70 }, { daysAgo: 10, score: 72 },
    { daysAgo: 0,  score: 72 },
  ]);

  // M2 : dégradation 74 → 41 (alarmant)
  await seedScores(m2.id, scoreModel.id, [
    { daysAgo: 90, score: 74 }, { daysAgo: 80, score: 71 }, { daysAgo: 70, score: 68 },
    { daysAgo: 60, score: 63 }, { daysAgo: 50, score: 57 }, { daysAgo: 40, score: 52 },
    { daysAgo: 30, score: 49 }, { daysAgo: 20, score: 45 }, { daysAgo: 10, score: 43 },
    { daysAgo: 0,  score: 41 },
  ]);

  // M3 : stable et excellent 88 → 91
  await seedScores(m3.id, scoreModel.id, [
    { daysAgo: 90, score: 88 }, { daysAgo: 80, score: 87 }, { daysAgo: 70, score: 89 },
    { daysAgo: 60, score: 90 }, { daysAgo: 50, score: 88 }, { daysAgo: 40, score: 91 },
    { daysAgo: 30, score: 90 }, { daysAgo: 20, score: 92 }, { daysAgo: 10, score: 91 },
    { daysAgo: 0,  score: 91 },
  ]);

  // M4 : remontée après creux 55 → 67
  await seedScores(m4.id, scoreModel.id, [
    { daysAgo: 90, score: 72 }, { daysAgo: 80, score: 68 }, { daysAgo: 70, score: 60 },
    { daysAgo: 60, score: 55 }, { daysAgo: 50, score: 57 }, { daysAgo: 40, score: 61 },
    { daysAgo: 30, score: 63 }, { daysAgo: 20, score: 65 }, { daysAgo: 10, score: 67 },
    { daysAgo: 0,  score: 67 },
  ]);

  // M5 : clôturé, belle progression 78 → 85
  await seedScores(m5.id, scoreModel.id, [
    { daysAgo: 120, score: 78 }, { daysAgo: 100, score: 80 }, { daysAgo: 80, score: 82 },
    { daysAgo: 60,  score: 83 }, { daysAgo: 40,  score: 84 }, { daysAgo: 20, score: 85 },
  ]);

  // ══════════════════════════════════════════════════════════════════════════════
  // NON-CONFORMITÉS
  // ══════════════════════════════════════════════════════════════════════════════
  const existingNCs = await prisma.nonConformite.findMany({ take: 1 });
  if (existingNCs.length === 0) {

    // M2 : 3 NC graves (marché en difficulté)
    await prisma.nonConformite.createMany({
      data: [
        {
          marketId: m2.id,
          ncType: NcType.SECURITE,
          severity: NcSeverity.CRITIQUE,
          description: "Défaut d'EPI — Technicien photographié sans casque ni chaussures de sécurité lors d'une intervention le 14/05/2026.",
          detectedAt: daysAgo(28),
          correctiveAction: "Rappel formation sécurité — tous les techniciens de la zone",
          rootCause: "Non-respect procédure EPI en situation d'urgence",
          status: NcStatus.OUVERTE,
          scoreImpact: 5,
          createdById: claire.id,
        },
        {
          marketId: m2.id,
          ncType: NcType.QUALITE,
          severity: NcSeverity.MAJEURE,
          description: "5 AAT non signés — chantiers CMD-2026-042 à 046 non transmis dans le délai contractuel.",
          detectedAt: daysAgo(18),
          correctiveAction: "Check-list de clôture renforcée, validation par le chef d'équipe",
          rootCause: "Absence de contrôle avant clôture administrative",
          status: NcStatus.EN_COURS,
          scoreImpact: 3,
          createdById: mickael.id,
        },
        {
          marketId: m2.id,
          ncType: NcType.QUALITE,
          severity: NcSeverity.CRITIQUE,
          description: "Urgence hors délai — CMD-2026-051 traitée en 96h au lieu de 72h. Pénalité 500€.",
          detectedAt: daysAgo(10),
          correctiveAction: "Mise en place astreinte renforcée — zone Hérault Centre",
          rootCause: "Équipe d'astreinte indisponible, pas de remplaçant identifié",
          status: NcStatus.OUVERTE,
          scoreImpact: 5,
          createdById: mickael.id,
        },
        // M1 : 1 NC
        {
          marketId: m1.id,
          ncType: NcType.QUALITE,
          severity: NcSeverity.MAJEURE,
          description: "Topo photogrammétrique manquant — CMD-2026-018 non remis à J+2. Pénalité 4% soit 124€.",
          detectedAt: daysAgo(15),
          correctiveAction: "Intégration du topo dans la check-list de clôture",
          rootCause: "Transmission documentaire oubliée lors de la clôture",
          status: NcStatus.EN_COURS,
          scoreImpact: 2,
          createdById: mickael.id,
        },
        // M4 : 2 NC
        {
          marketId: m4.id,
          ncType: NcType.SECURITE,
          severity: NcSeverity.MAJEURE,
          description: "Balisage insuffisant lors de l'intervention du 02/05 — non conforme NF P98-332.",
          detectedAt: daysAgo(22),
          correctiveAction: "Formation balisage — équipe chantier concernée",
          rootCause: "Matériel de balisage incomplet sur le véhicule",
          closedAt: daysAgo(2),
          status: NcStatus.CLOTUREE,
          scoreImpact: 0,
          createdById: claire.id,
        },
        {
          marketId: m4.id,
          ncType: NcType.QUALITE,
          severity: NcSeverity.MINEURE,
          description: "Rapport mensuel KPI avril transmis le 21/05 au lieu du 15/05 (délai contractuel).",
          detectedAt: daysAgo(8),
          correctiveAction: "Rappel automatique dans l'agenda partagé à J-3",
          rootCause: "Oubli — pas d'alerte en place",
          status: NcStatus.EN_COURS,
          scoreImpact: 1,
          createdById: mickael.id,
        },
      ],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ALERTES
  // ══════════════════════════════════════════════════════════════════════════════
  const existingAlerts = await prisma.alert.findMany({ take: 1 });
  if (existingAlerts.length === 0) {
    await prisma.alert.createMany({
      data: [
        {
          marketId: m2.id,
          alertType: "URGENCE_HORS_DELAI",
          severity: AlertSeverity.CRITIQUE,
          cause: "Intervention urgente réalisée en 96h au lieu de 72h",
          responsibleUserId: mickael.id,
          expectedAction: "Renforcer l'astreinte — zone Hérault Centre immédiatement",
          dueAt: daysFromNow(3),
        },
        {
          marketId: m2.id,
          alertType: "TOPO_MANQUANT",
          severity: AlertSeverity.CRITIQUE,
          cause: "3 topographies requises non remises à date",
          responsibleUserId: mickael.id,
          expectedAction: "Livrer les topos avant vendredi sous peine de pénalité",
          dueAt: daysFromNow(2),
        },
        {
          marketId: m2.id,
          alertType: "SCORE_FAIBLE",
          severity: AlertSeverity.CRITIQUE,
          cause: "Score contractuel sous le seuil critique (41/100)",
          responsibleUserId: directeur.id,
          expectedAction: "Réunion de crise avec le client — plan de remédiation à 30 jours",
          dueAt: daysFromNow(7),
        },
        {
          marketId: m1.id,
          alertType: "TOPO_MANQUANT",
          severity: AlertSeverity.MAJEUR,
          cause: "Topo CMD-2026-018 non remis — pénalité 4% en cours",
          responsibleUserId: mickael.id,
          expectedAction: "Transmettre le topo manquant avant lundi",
          dueAt: daysFromNow(4),
        },
        {
          marketId: m4.id,
          alertType: "RETARD_PLANIFICATION",
          severity: AlertSeverity.MINEUR,
          cause: "Taux de réception à 42% — sous le seuil contractuel année 1 (45%)",
          responsibleUserId: mickael.id,
          expectedAction: "Accélérer la cadence de réception sur les prochaines semaines",
          dueAt: daysFromNow(14),
        },
      ],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════════════════
  const existingActions = await prisma.actionPlan.findMany({ take: 1 });
  if (existingActions.length === 0) {
    await prisma.actionPlan.createMany({
      data: [
        {
          marketId: m2.id,
          title: "Plan de remédiation — Hérault Centre",
          description: "Définir et valider avec le client un plan de remédiation sur 30 jours pour remonter le score au-dessus de 60.",
          priority: "1",
          category: "Pilotage contractuel",
          riskCovered: "Résiliation pour faute — seuil critique franchi",
          responsibleUserId: directeur.id,
          expectedResult: "Score ≥ 60 dans 30 jours, levée des alertes critiques",
          targetDate: daysFromNow(10),
          status: ActionStatus.IN_PROGRESS,
        },
        {
          marketId: m2.id,
          title: "Astreinte urgences renforcée — Hérault",
          description: "Mettre en place 2 équipes dédiées aux urgences sur la zone, avec protocole de remplacement systématique.",
          priority: "1",
          category: "Délais",
          riskCovered: "Urgence hors délai — 500€/intervention",
          responsibleUserId: mickael.id,
          expectedResult: "100% des urgences dans le délai contractuel",
          targetDate: daysFromNow(7),
          status: ActionStatus.IN_PROGRESS,
        },
        {
          marketId: m1.id,
          title: "Check-list de clôture chantier",
          description: "Bloquer la clôture informatique si AAT/PAT/topo manquent. Validation obligatoire par le responsable marché.",
          priority: "2",
          category: "Conformité documentaire",
          riskCovered: "Pénalités documentaires (4% commande)",
          responsibleUserId: mickael.id,
          expectedResult: "0 topo manquant à partir de juin 2026",
          targetDate: daysFromNow(21),
          status: ActionStatus.IN_PROGRESS,
        },
        {
          marketId: m3.id,
          title: "Capitaliser sur les bonnes pratiques GRDF",
          description: "Documenter le processus de suivi GRDF Occitanie pour le répliquer sur les autres marchés Enedis.",
          priority: "3",
          category: "Amélioration continue",
          riskCovered: "Uniformiser le niveau de qualité du portefeuille",
          responsibleUserId: directeur.id,
          expectedResult: "Guide de bonnes pratiques partagé à toute l'équipe",
          targetDate: daysFromNow(45),
          status: ActionStatus.TODO,
        },
        {
          marketId: m4.id,
          title: "Rattrapage taux de réception — Montpellier Nord",
          description: "Identifier les chantiers réceptionnables et planifier les visites dans les 15 prochains jours.",
          priority: "2",
          category: "Réception",
          riskCovered: "Seuil de réception contractuel non atteint",
          responsibleUserId: mickael.id,
          expectedResult: "Taux de réception à 50% fin juin 2026",
          targetDate: daysFromNow(15),
          status: ActionStatus.IN_PROGRESS,
        },
        // Actions en retard — visibles dans le dashboard
        {
          marketId: m2.id,
          title: "Livrer les 3 topographies manquantes",
          description: "Urgence : 3 commandes sans topo depuis plus de 5 jours. Pénalité active.",
          priority: "1",
          category: "Conformité documentaire",
          riskCovered: "Pénalités 4% × 3 commandes",
          responsibleUserId: mickael.id,
          expectedResult: "Topos livrés et validés par Enedis",
          targetDate: daysAgo(3),
          status: ActionStatus.IN_PROGRESS,
        },
        {
          marketId: m1.id,
          title: "Rappel sécurité EPI — équipe Aude",
          description: "Organiser une sensibilisation sécurité suite à l'audit terrain du 10/05.",
          priority: "2",
          category: "Sécurité",
          riskCovered: "NC sécurité — avertissement client",
          responsibleUserId: claire.id,
          expectedResult: "0 écart EPI constaté sur audit suivant",
          targetDate: daysAgo(5),
          status: ActionStatus.TODO,
        },
      ],
    });
  }

  // ── DONNÉES MARCHÉ 1 (chantiers, événements) ──────────────────────────────────
  const existingProjects = await prisma.project.findMany({ where: { marketId: m1.id } });
  if (existingProjects.length === 0) {
    const p1 = await prisma.project.create({
      data: {
        marketId: m1.id,
        projectCode: "CH-0001",
        orderNumber: "CMD-2026-001",
        siteName: "Carcassonne Nord",
        zoneName: "Aude Ouest",
        plannedDate:    new Date("2026-02-12"),
        performedDate:  new Date("2026-02-12"),
        receptionDate:  new Date("2026-02-14"),
        isUrgent: true, isUrgentLate: false,
        topoRequired: true, topoDelivered: true,
        aatSigned: true, aatDate: new Date("2026-02-14"),
        patReceived: true,
        drumInvolved: true, drumRecoveryRequestedAt: new Date("2026-03-01"),
        orderedAmountHt: 4200, performedAmountHt: 4200, receivedAmountHt: 4200,
        status: "RECEPTIONNE",
      },
    });

    const p2 = await prisma.project.create({
      data: {
        marketId: m1.id,
        projectCode: "CH-0002",
        orderNumber: "CMD-2026-018",
        siteName: "Limoux",
        zoneName: "Aude Ouest",
        plannedDate:   new Date("2026-02-18"),
        performedDate: new Date("2026-02-19"),
        isUrgent: true, isUrgentLate: true,
        topoRequired: true, topoDelivered: false,
        aatSigned: true, aatDate: new Date("2026-02-20"),
        patReceived: false,
        drumInvolved: true,
        orderedAmountHt: 3100, performedAmountHt: 3100, receivedAmountHt: 0,
        status: "EN_COURS",
      },
    });

    await prisma.projectDocument.createMany({
      data: [
        {
          marketId: m1.id, projectId: p1.id, documentTypeId: docAAT.id,
          isMandatory: true, expectedDate: new Date("2026-02-14"),
          receivedDate: new Date("2026-02-14"), isValid: true,
        },
        {
          marketId: m1.id, projectId: p1.id, documentTypeId: docPAT.id,
          isMandatory: true, expectedDate: new Date("2026-02-16"),
          receivedDate: new Date("2026-02-15"), isValid: true,
        },
        {
          marketId: m1.id, projectId: p2.id, documentTypeId: docAAT.id,
          isMandatory: true, expectedDate: new Date("2026-02-20"),
          receivedDate: null, isValid: false, lateDays: 8,
          comments: "AAT non signé",
        },
      ],
    });

    await prisma.marketEvent.createMany({
      data: [
        {
          marketId: m1.id, projectId: p2.id,
          eventType: "PENALITE", eventSubtype: "URGENCE_HORS_DELAI",
          eventDate: new Date("2026-02-19"), articleRef: "34.6",
          amountHt: 500, rootCause: "Équipe indisponible",
          responsibility: "Titulaire", correctiveAction: "Réserve capacité urgences",
        },
        {
          marketId: m1.id, projectId: p1.id,
          eventType: "BONUS", eventSubtype: "SITUATION_DANGEREUSE_REMONTÉE",
          eventDate: new Date("2026-02-12"), articleRef: "23.4",
          amountHt: 100, rootCause: "NA",
          responsibility: "Titulaire", correctiveAction: "Continuer remontées sécurité",
        },
      ],
    });

    // Clauses marché 1
    const mc1 = await prisma.marketClause.create({
      data: {
        marketId: m1.id, clauseReferenceId: clauseUrgence.id,
        articleRef: "34.6", title: "Urgence hors délai — 500 €/intervention",
        description: "Pénalité de 500 € par intervention urgente réalisée hors délai.",
        criticality: Criticality.CRITIQUE, isContractual: true, requiresFollowUp: true,
      },
    });
    const mc2 = await prisma.marketClause.create({
      data: {
        marketId: m1.id, clauseReferenceId: clauseTopo.id,
        articleRef: "34.6", title: "Topo photogrammétrique non remis — 4%",
        description: "Pénalité de 4% de la valeur de la commande si topo requis non livré.",
        criticality: Criticality.CRITIQUE, isContractual: true, requiresFollowUp: true,
      },
    });

    await prisma.marketObligation.createMany({
      data: [
        {
          marketId: m1.id, clauseId: mc1.id,
          title: "Respecter les délais d'intervention en urgence",
          description: "Toute intervention urgente dans le délai contractuel.",
          category: "Délais", criticality: Criticality.CRITIQUE,
          frequency: "Chaque intervention", triggerCondition: "Commande urgente",
          expectedEvidence: "Horodatage ordre et réalisation",
          dueRule: "Immédiat", ownerUserId: mickael.id,
        },
        {
          marketId: m1.id, clauseId: mc2.id,
          title: "Remettre le topo photogrammétrique lorsqu'il est commandé",
          description: "Topo livré à Enedis dans les 2 jours après réalisation.",
          category: "Documents", criticality: Criticality.CRITIQUE,
          frequency: "Chaque chantier concerné", triggerCondition: "Topo requis",
          expectedEvidence: "Fichier topo + validation Enedis",
          dueRule: "J+2 après réalisation", ownerUserId: mickael.id,
        },
      ],
    });

    // KPIs marché 1
    await prisma.marketKpi.createMany({
      data: [
        {
          marketId: m1.id, kpiReferenceId: kpiUrgence.id,
          kpiCode: "KPI_URG_001", name: "Taux de respect des urgences",
          category: "Délais", kpiType: "Contractuel", unit: "%", frequency: "Hebdo",
          greenThreshold: 100, orangeThreshold: 95, redThreshold: 90,
          currentValue: 88, targetValue: 100,
        },
        {
          marketId: m1.id, kpiReferenceId: kpiSec.id,
          kpiCode: "KPI_SEC_001", name: "Note de sécurité",
          category: "Sécurité", kpiType: "Contractuel", unit: "/20", frequency: "Trimestriel",
          greenThreshold: 18, orangeThreshold: 16, redThreshold: 14,
          currentValue: 16.5, targetValue: 18,
        },
      ],
    });
  }

  // ── KPIs marchés 2, 3, 4 ─────────────────────────────────────────────────────
  for (const [mid, urgVal, secVal] of [
    [m2.id, 62, 13.5],
    [m3.id, 100, 18.5],
    [m4.id, 91, 15.0],
  ] as [string, number, number][]) {
    const already = await prisma.marketKpi.findFirst({ where: { marketId: mid } });
    if (!already) {
      await prisma.marketKpi.createMany({
        data: [
          {
            marketId: mid, kpiReferenceId: kpiUrgence.id,
            kpiCode: "KPI_URG_001", name: "Taux de respect des urgences",
            category: "Délais", kpiType: "Contractuel", unit: "%", frequency: "Hebdo",
            greenThreshold: 100, orangeThreshold: 95, redThreshold: 90,
            currentValue: urgVal, targetValue: 100,
          },
          {
            marketId: mid, kpiReferenceId: kpiSec.id,
            kpiCode: "KPI_SEC_001", name: "Note de sécurité",
            category: "Sécurité", kpiType: "Contractuel", unit: "/20", frequency: "Trimestriel",
            greenThreshold: 18, orangeThreshold: 16, redThreshold: 14,
            currentValue: secVal, targetValue: 18,
          },
        ],
      });
    }
  }

  console.log("✅ Seed terminé — 5 marchés, scores, NCs, alertes, actions");
  console.log("");
  console.log("  Comptes de démonstration :");
  console.log("  admin@comelec.local      / password123  (ADMIN)");
  console.log("  direction@comelec.local  / password123  (DIRECTEUR)");
  console.log("  marche@comelec.local     / password123  (RESPONSABLE_MARCHE)");
  console.log("  qse@comelec.local        / password123  (QSE)");
  console.log("");
  console.log("  Marchés créés :");
  console.log("  ECB2303550 — Enedis Aude Ouest         score 72  (en cours)");
  console.log("  ECB2303720 — Enedis Hérault Centre     score 41  ⚠️  critique");
  console.log("  GDF2404100 — GRDF Occitanie            score 91  ✅  excellent");
  console.log("  VDM2502010 — Éclairage Montpellier     score 67  (suivi requis)");
  console.log("  SNC2201300 — SNCF signalisation        score 85  ✅  clôturé");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
