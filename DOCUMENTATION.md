# Contract Pilot — Documentation complète

> Ce document couvre le **fonctionnement métier** du logiciel, son **architecture technique**,
> et une **évaluation honnête** de la stack pour aider à décider comment l'entretenir,
> le faire évoluer et le déployer durablement.

---

## Table des matières

1. [Qu'est-ce que Contract Pilot ?](#1-quest-ce-que-contract-pilot-)
2. [Les modules fonctionnels](#2-les-modules-fonctionnels)
3. [Les rôles utilisateurs](#3-les-rôles-utilisateurs)
4. [Comment fonctionne l'analyse IA ?](#4-comment-fonctionne-lanalyse-ia-)
5. [Comment fonctionne le score santé ?](#5-comment-fonctionne-le-score-santé-)
6. [Architecture technique](#6-architecture-technique)
7. [Évaluation honnête de la stack](#7-évaluation-honnête-de-la-stack)
8. [Déploiement — état actuel et recommandations](#8-déploiement--état-actuel-et-recommandations)
9. [Scalabilité — jusqu'où peut-on aller ?](#9-scalabilité--jusqu-où-peut-on-aller-)
10. [Recommandations concrètes pour la suite](#10-recommandations-concrètes-pour-la-suite)

---

## 1. Qu'est-ce que Contract Pilot ?

Contract Pilot est une **application web interne** de pilotage contractuel. Elle centralise le suivi de tous les marchés de travaux, maintenance et réseaux d'une entreprise.

### Le problème qu'elle résout

Sans outil dédié, le suivi d'un marché se fait généralement dans des fichiers Excel dispersés :
un fichier pour les pénalités, un autre pour les alertes, un autre pour les chantiers… Ce fonctionnement crée des oublis, des retards de réaction et une perte de visibilité globale.

Contract Pilot remplace ces fichiers par **une application unique** où tout est lié, traçable et visible en temps réel.

### Ce que le logiciel fait concrètement

- **Lit et comprend les contrats** (PDF) grâce à l'IA Claude (Anthropic)
- **Extrait automatiquement** les clauses contractuelles, KPI, obligations, pénalités et bonus
- **Surveille les seuils** et génère des alertes si un KPI passe au rouge
- **Calcule un score santé** par marché (de 0 à 100) et en garde l'historique
- **Suit les chantiers** (délais, réception, documents)
- **Enregistre les non-conformités QHSE** avec impact automatique sur le score
- **Gère les avenants** (modifications contractuelles)
- **Envoie des emails** en cas d'alerte critique
- **Propose un tableau de bord** global avec les indicateurs les plus importants

---

## 2. Les modules fonctionnels

Chaque marché dispose de sa propre fiche avec les onglets suivants :

### Vue d'ensemble
Page de synthèse : score santé, alertes ouvertes, KPI principaux, résumé exécutif du contrat, derniers événements financiers (pénalités, bonus).

### Analyse IA
L'utilisateur glisse-dépose le PDF du contrat. L'application extrait le texte, l'envoie à Claude (Anthropic) et reçoit une analyse structurée :
- Résumé exécutif
- Clauses critiques avec référence d'article
- KPI à suivre (avec seuils vert/orange/rouge)
- Obligations contractuelles (preuve attendue, délai, déclencheur)
- Pénalités et bonus (formule et condition)
- Synthèse financière (montants, durée, index de révision)

Un responsable valide l'analyse avant qu'elle soit importée dans le marché.

### Clauses
Liste de toutes les clauses contractuelles extraites ou saisies manuellement, classées par criticité (CRITIQUE / FORT / MOYEN / FAIBLE).

### KPI
Suivi des indicateurs de performance. Chaque KPI a des seuils colorés. La valeur actuelle est mise à jour manuellement ou par les NC QHSE.

### Obligations
Suivi des obligations contractuelles : ce qui doit être fait, quand, avec quelle preuve.

### Chantiers (Projets)
Suivi opérationnel de chaque chantier : planifié, réalisé, réceptionné, documents fournis, montants commandés/réalisés/réceptionnés, urgences, aléas.

### Documents
Suivi des documents obligatoires par chantier : AAT, PAT, topo, etc. Avec statut, date de réception et validation.

### Alertes
Système d'alertes automatique (calculé depuis les données des chantiers) et manuel. Chaque alerte a une sévérité (MINEUR / MAJEUR / CRITIQUE) et un statut (OPEN / IN_PROGRESS / CLOSED).

### Actions
Plan d'action corrective lié aux alertes. Chaque action a une priorité, une échéance et un responsable.

### Avenants
Suivi des modifications contractuelles (avenants) : nature, delta de montant, delta de délai, statut de signature.

### NC QHSE
Enregistrement des non-conformités qualité, sécurité et environnement. Chaque NC a une sévérité et **impacte automatiquement le score santé** du marché (−1 pt pour MINEURE, −3 pour MAJEURE, −5 pour CRITIQUE). La fermeture de la NC restaure les points.

### Scoring
Configuration des **pondérations par indicateur** (délais, sécurité, qualité, documents…) pour ce marché spécifique. Un marché à fort enjeu sécurité peut peser 30% sur la sécurité au lieu de 20% par défaut.

### Historique des scores
Graphique de l'évolution du score santé dans le temps. Un snapshot est enregistré automatiquement une fois par jour (à chaque visite de la Vue d'ensemble). Le bouton "Calculer maintenant" force un snapshot immédiat.

### Défense de marché
Module de préparation aux revues contractuelles. Pour chaque indicateur, le responsable peut rédiger une justification et un plan d'action. Export PDF via impression navigateur.

### Exports
Export Excel et PDF des données du marché (chantiers, KPI, alertes, événements financiers).

### Historique
Journal de toutes les actions effectuées sur le marché (qui a fait quoi et quand).

---

## 3. Les rôles utilisateurs

| Rôle | Niveau | Ce qu'il peut faire |
|---|---|---|
| **ADMIN** | 100 | Tout, y compris gérer les utilisateurs et les paramètres globaux |
| **DIRECTEUR** | 80 | Consulter tout, archiver des marchés, gérer les paramètres |
| **RESPONSABLE_MARCHE** | 60 | Créer/modifier des marchés, lancer l'analyse IA, valider |
| **EXPLOITATION** | 40 | Saisir chantiers, alertes, actions, NC |
| **QSE** | 40 | Idem EXPLOITATION, focus sécurité/qualité |
| **LECTURE** | 10 | Consultation uniquement, aucune modification |

> Les rôles sont définis dans `src/lib/permissions.ts`. Modifier les niveaux là-bas suffit pour changer qui peut faire quoi.

---

## 4. Comment fonctionne l'analyse IA ?

```
PDF uploadé
    │
    ▼
Extraction texte (pdf-parse)
    │
    ▼
Envoi à Claude (Anthropic API) avec prompt expert
    │
    ▼
Réponse JSON structurée (clauses, KPI, obligations, pénalités…)
    │
    ▼
Prévisualisation dans l'interface (6 onglets)
    │
    ▼
Validation manuelle par un responsable
    │
    ▼
Création automatique des clauses, KPI, obligations dans le marché
```

**Sans clé API Anthropic :** l'application utilise un jeu de données de démonstration réaliste (marché Enedis fictif). Tout fonctionne, mais l'analyse n'est pas réelle.

**Avec clé API :** le modèle `claude-sonnet-4-5` est utilisé par défaut (rapide et précis). Configurable via la variable `ANTHROPIC_MODEL` dans le `.env`.

**Limite importante :** l'extraction de texte ne fonctionne que sur les **PDF natifs** (créés numériquement). Les PDF **scannés** (images) ne donnent pas de texte. Pour les PDF scannés, il faudrait ajouter une couche OCR (hors scope actuel).

---

## 5. Comment fonctionne le score santé ?

Le score est calculé à la demande (ou automatiquement à chaque visite de la Vue d'ensemble). Il agrège 8 indicateurs pondérés :

| Indicateur | Poids défaut | Source de données |
|---|---|---|
| Délais | 20% | Taux d'urgences réalisées dans le délai |
| Sécurité | 20% | Valeur KPI sécurité (impacté par les NC) |
| Qualité | 15% | Valeur KPI qualité (impacté par les NC) |
| Documents | 15% | KPI conformité documentaire |
| Réception | 10% | Ratio montants réceptionnés / réalisés |
| Pénalités | 10% | Ratio pénalités / montants réalisés (inversé) |
| Alertes | 5% | −25 pts par alerte critique ouverte |
| Bonus | 5% | Présence de bonus contractuels |

**Score total = somme des (score normalisé × poids) / 100**

Les poids sont personnalisables par marché (onglet Scoring). Les marchés sans personnalisation utilisent les valeurs par défaut ci-dessus.

### Interprétation

| Score | Label | Couleur |
|---|---|---|
| ≥ 80 | Bon | 🟢 Vert |
| 60–79 | Sous surveillance | 🟠 Orange |
| 40–59 | En difficulté | 🔴 Rouge |
| < 40 | Critique | 🔴 Rouge foncé |

---

## 6. Architecture technique

### Stack utilisée

```
┌─────────────────────────────────────────────────────┐
│                    NAVIGATEUR                       │
│         React 19 + Tailwind CSS + shadcn/ui         │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/HTTPS
┌─────────────────────▼───────────────────────────────┐
│               SERVEUR APPLICATION                   │
│              Next.js 16 (App Router)                │
│   ┌──────────────────────────────────────────────┐  │
│   │  Pages (RSC)  │  API Routes  │  Auth (JWT)   │  │
│   └──────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────┐  │
│   │       Prisma ORM  +  NextAuth v5             │  │
│   └──────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │ TCP 5432
┌─────────────────────▼───────────────────────────────┐
│                  PostgreSQL 16                      │
│              (données + fichiers path)              │
└─────────────────────────────────────────────────────┘
                      │ HTTPS (optionnel)
┌─────────────────────▼───────────────────────────────┐
│               SERVICES EXTERNES                     │
│   Anthropic API (IA)  │  SMTP (emails)              │
└─────────────────────────────────────────────────────┘
```

### Arborescence des dossiers clés

```
src/
├── app/
│   ├── (app)/              ← Pages protégées par authentification
│   │   ├── dashboard/      ← Dashboard global
│   │   ├── markets/        ← Liste + détail de chaque marché
│   │   │   └── [marketId]/ ← Onglets : overview, analysis, scoring, nc, ...
│   │   └── settings/       ← Paramètres (utilisateurs, email, scoring...)
│   └── api/                ← Routes API REST (Next.js Route Handlers)
│       ├── analysis/       ← Lance l'analyse IA
│       ├── markets/        ← CRUD marchés + sous-ressources
│       └── users/          ← Gestion des comptes
├── components/
│   ├── layout/             ← Sidebar, Topbar, structure
│   ├── markets/            ← Composants spécifiques aux marchés
│   ├── analysis/           ← Panel d'analyse IA
│   └── ui/                 ← Composants réutilisables (shadcn/ui)
├── lib/
│   ├── auth.ts             ← Configuration NextAuth
│   ├── prisma.ts           ← Client Prisma singleton
│   ├── llm.ts              ← Service d'analyse IA (Claude)
│   ├── pdf.ts              ← Extraction texte PDF
│   ├── score.ts            ← Calcul du score santé
│   ├── nc.ts               ← Impact NC QHSE sur les KPI
│   ├── alerts.ts           ← Recalcul des alertes
│   ├── email.ts            ← Envoi d'emails (nodemailer)
│   ├── audit.ts            ← Journal des actions
│   └── permissions.ts      ← Définition des rôles et droits
└── types/                  ← Déclarations TypeScript supplémentaires

prisma/
├── schema.prisma           ← Schéma de base de données (source de vérité)
└── seed.ts                 ← Données initiales (compte admin, références)
```

### Base de données — tables principales

| Table | Rôle |
|---|---|
| `User` | Comptes utilisateurs avec rôle et mot de passe haché |
| `Market` | Fiche du marché (code, client, montants, dates, statut) |
| `MarketScore` | Historique des snapshots de score |
| `MarketScoreWeight` | Pondérations personnalisées par marché |
| `MarketKpi` | KPI du marché avec valeurs et seuils |
| `MarketClause` | Clauses contractuelles |
| `MarketObligation` | Obligations contractuelles |
| `Project` | Chantiers associés au marché |
| `Alert` | Alertes générées sur les chantiers |
| `ActionPlan` | Plan d'actions correctives |
| `Avenant` | Modifications contractuelles |
| `NonConformite` | NC QHSE avec impact score |
| `MarketEvent` | Événements financiers (pénalités, bonus) |
| `AuditLog` | Journal de toutes les actions |
| `ContractAnalysisRun` | Historique des analyses IA avec résultats bruts |

---

## 7. Évaluation honnête de la stack

> Cette section est volontairement critique. L'objectif est d'identifier les points forts à conserver et les faiblesses à adresser avant de déployer en production ou de faire évoluer le projet.

### ✅ Ce qui fonctionne bien

**Next.js + TypeScript**
La combinaison est très productive et très répandue. Des milliers de tutoriels, une communauté massive, des mises à jour fréquentes. TypeScript prévient de nombreux bugs à la compilation.

**Prisma ORM**
Excellent choix. Le schéma `schema.prisma` est la source de vérité unique pour la base de données. Les migrations sont simples (`prisma db push` en dev, `prisma migrate` en production). Le client généré est fortement typé.

**PostgreSQL**
Base de données relationnelle éprouvée, parfaite pour ce type de données structurées avec des relations (marchés → chantiers → documents).

**Docker Compose**
Le déploiement est reproductible. N'importe quel serveur avec Docker peut faire tourner l'application. C'est le bon choix pour un déploiement interne.

**shadcn/ui + Tailwind**
Composants accessibles, cohérents, et entièrement personnalisables sans dépendance externe. Le style est directement dans le code (pas de fichiers CSS séparés à maintenir).

---

### ⚠️ Ce qui demande de l'attention

#### 1. Next.js App Router — complexité élevée pour des débutants

Le modèle mental du **App Router** (React Server Components vs Client Components, `"use client"`, `async` sur les layouts…) est **non trivial**. Un développeur qui connaît React classique mais pas Next.js App Router peut facilement introduire des bugs subtils (données non rafraîchies, erreur d'hydratation, mauvaise frontière server/client).

> **Recommandation :** Si le projet doit être maintenu par une équipe sans expérience Next.js, investir dans une formation courte sur le App Router (2-3 jours) avant de toucher au code.

#### 2. NextAuth v5 — encore en bêta

La version utilisée (`next-auth@5.0.0-beta.31`) est **fonctionnelle mais pas stable**. Des changements d'API peuvent survenir à chaque mise à jour mineure. Le passage de v4 à v5 a déjà imposé plusieurs refactos (callbacks typés manuellement, etc.).

> **Recommandation :** Geler la version de NextAuth dans `package.json` (`"next-auth": "5.0.0-beta.31"`) et ne mettre à jour que de manière contrôlée, après avoir testé.

#### 3. Aucun test automatisé

Le projet n'a **aucun test** (unitaire, intégration, ni end-to-end). En cas de refactorisation ou d'ajout de fonctionnalité, il n'y a aucun filet de sécurité.

> **Recommandation :** Ajouter au minimum des tests sur les fonctions critiques :
> - `calculateMarketScore()` dans `score.ts`
> - `applyNcImpactToKpi()` dans `nc.ts`
> - Les routes API les plus sensibles (DELETE user, validate analysis)
>
> Outils suggérés : **Vitest** (rapide, compatible TypeScript, intégré à Vite) pour les tests unitaires.

#### 4. Stockage des fichiers sur le disque local

Les fichiers uploadés (contrats PDF) sont sauvegardés **sur le système de fichiers du serveur** (`uploads/` via `src/lib/storage.ts`). C'est simple, mais ça pose des problèmes :
- Les fichiers ne sont pas inclus dans les sauvegardes de la base de données
- Si le container est recréé, les fichiers sont perdus (sauf si le dossier est monté en volume)
- Impossible de faire tourner plusieurs instances en parallèle

> **Recommandation immédiate :** Vérifier que le dossier `uploads/` est monté en **volume Docker** dans `docker-compose.yml`. Si ce n'est pas le cas, les fichiers disparaissent à chaque redémarrage.
>
> **Recommandation à moyen terme :** Migrer vers un stockage objet comme **MinIO** (auto-hébergé, compatible S3) ou un service cloud (S3, Azure Blob).

#### 5. Pas de gestion des jobs en arrière-plan

Les emails sont envoyés en **fire-and-forget** (`void asyncFn()`). Si l'envoi échoue, il n'y a aucun retry. Pour le digest quotidien, il n'existe pas de cron job intégré — il faut l'appeler manuellement ou depuis un outil externe.

> **Recommandation :** Pour un usage intensif, ajouter une file de tâches simple. **BullMQ** avec Redis est l'option standard dans l'écosystème Node.js. Pour une solution plus légère, **pg-boss** (file de tâches dans PostgreSQL, pas de Redis supplémentaire) est parfait pour ce projet.

#### 6. Variables d'environnement non validées au démarrage

Si une variable d'environnement obligatoire est manquante (`DATABASE_URL`, `NEXTAUTH_SECRET`…), l'application démarre quand même mais plante à runtime de manière cryptique.

> **Recommandation :** Ajouter une validation au démarrage avec **Zod** :
> ```typescript
> // src/lib/env.ts
> import { z } from "zod";
> export const env = z.object({
>   DATABASE_URL: z.string().url(),
>   NEXTAUTH_SECRET: z.string().min(32),
>   NEXTAUTH_URL: z.string().url(),
> }).parse(process.env);
> ```

---

### ❌ Ce qui est à revoir pour la production

#### Authentification — mots de passe uniquement

L'application n'utilise que des mots de passe. Pas de 2FA, pas de SSO (Active Directory / LDAP). Pour une entreprise avec un annuaire interne, l'intégration LDAP/Active Directory via NextAuth est réalisable mais non implémentée.

#### Pas de rate limiting sur les API

Les routes API n'ont pas de protection contre les appels abusifs (ex : tentatives de brute-force sur la route de connexion).

> **Recommandation :** Utiliser un reverse proxy (Nginx, Traefik) devant l'application pour le rate limiting, ou ajouter un middleware Next.js avec la librairie `@upstash/ratelimit`.

---

## 8. Déploiement — état actuel et recommandations

### Ce qui existe déjà

```yaml
# docker-compose.yml
services:
  postgres:          # Base de données avec healthcheck
  app:               # Application Next.js en mode standalone
    depends_on:
      postgres: { condition: service_healthy }
    volumes:
      - uploads:/app/uploads   # ← CRITIQUE : vérifier que cette ligne existe
```

### Schéma de déploiement recommandé pour un serveur interne

```
Internet / Réseau interne
        │
        ▼
   [Nginx / Traefik]         ← Reverse proxy (HTTPS, rate-limit, logs)
        │
        ▼
   [Contract Pilot]          ← Container Docker, port 3000
        │
        ▼
   [PostgreSQL]               ← Container Docker, volume persistant
        │
        ▼
   [Backups automatiques]     ← pg_dump quotidien vers un dossier ou NAS
```

### Checklist déploiement production

- [ ] `docker-compose.yml` monte le volume `uploads` en persistant
- [ ] `NEXTAUTH_URL` pointe vers l'URL réelle du serveur (avec HTTPS si possible)
- [ ] `NEXTAUTH_SECRET` est un secret fort (≥ 32 caractères aléatoires)
- [ ] `DB_PASSWORD` est fort et différent du défaut
- [ ] Le port 5432 (PostgreSQL) **n'est pas exposé** sur le réseau externe
- [ ] Un script de sauvegarde `pg_dump` tourne quotidiennement
- [ ] Les sauvegardes sont stockées sur un disque séparé ou un NAS
- [ ] Un reverse proxy (Nginx) gère le HTTPS avec un certificat valide

### Commandes utiles en production

```bash
# Démarrer
docker-compose up -d

# Voir les logs en temps réel
docker-compose logs -f app

# Redémarrer l'application sans toucher la DB
docker-compose restart app

# Mettre à jour après une nouvelle version
git pull
docker-compose build app
docker-compose up -d

# Sauvegarde manuelle de la base
docker-compose exec postgres pg_dump -U contractpilot contractpilot > backup_$(date +%Y%m%d).sql

# Restaurer une sauvegarde
docker-compose exec -T postgres psql -U contractpilot contractpilot < backup_20240101.sql
```

---

## 9. Scalabilité — jusqu'où peut-on aller ?

### Charge actuelle — ce que supporte l'architecture

| Dimension | Limite estimée avec l'architecture actuelle |
|---|---|
| Utilisateurs simultanés | 20–50 sans problème, 100+ avec tuning |
| Nombre de marchés | Plusieurs centaines sans problème |
| Taille de la DB | Jusqu'à plusieurs Go sans tuning PostgreSQL |
| Fréquence des analyses IA | Limitée par le quota Anthropic API |

L'application **n'est pas conçue pour une utilisation publique à grande échelle**, mais pour une équipe interne de quelques dizaines de personnes. C'est son point fort : elle est simple à déployer et à maintenir.

### Si le projet grandit

**Scénario : plusieurs équipes / plusieurs entreprises (multi-tenant)**
→ Ajouter un champ `organizationId` sur toutes les tables principales et filtrer toutes les requêtes par organisation. C'est un chantier significatif mais Prisma facilite les migrations.

**Scénario : forte charge (> 200 utilisateurs simultanés)**
→ PostgreSQL est déjà un bon choix. Ajouter un cache Redis pour les données fréquemment lues (scores, liste marchés).

**Scénario : fichiers nombreux et volumineux**
→ Migrer le stockage vers MinIO (S3-compatible, auto-hébergé) ou un service cloud.

**Scénario : analyses IA fréquentes**
→ Mettre en file d'attente (BullMQ) pour éviter de bloquer les requêtes HTTP et gérer les retries.

---

## 10. Recommandations concrètes pour la suite

Classées par priorité pour un déploiement serein :

### Priorité haute (avant mise en production)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Vérifier que le volume `uploads` est persistant dans `docker-compose.yml` | 1h | Critique — sans ça les fichiers disparaissent |
| 2 | Geler la version de `next-auth` dans `package.json` | 15 min | Évite les breaking changes inattendus |
| 3 | Mettre en place un cron `pg_dump` quotidien | 2h | Protection contre la perte de données |
| 4 | Ajouter un reverse proxy Nginx avec HTTPS | 4h | Sécurité réseau de base |

### Priorité moyenne (dans les 3 premiers mois)

| # | Action | Effort | Impact |
|---|---|---|---|
| 5 | Validation des variables d'env au démarrage (Zod) | 2h | Erreurs claires au lieu de crashes cryptiques |
| 6 | Tests unitaires sur score.ts et nc.ts | 1 jour | Filet de sécurité pour les évolutions |
| 7 | Migration stockage fichiers vers MinIO | 2–3 jours | Robustesse et scalabilité des fichiers |
| 8 | Rate limiting sur les routes de connexion | 4h | Sécurité basique anti brute-force |

### Priorité basse (évolutions futures)

| # | Action | Effort | Impact |
|---|---|---|---|
| 9 | File de tâches (pg-boss) pour les emails et calculs lourds | 3–5 jours | Robustesse des opérations asynchrones |
| 10 | OCR pour les PDF scannés (Tesseract.js) | 3–5 jours | Analyse de 100% des PDF |
| 11 | SSO / LDAP Active Directory | 1–2 semaines | Intégration annuaire entreprise |
| 12 | Import en masse de chantiers depuis CSV/Excel | 3 jours | Gain de temps opérationnel |
| 13 | Application mobile (PWA ou React Native) | 2–4 semaines | Saisie terrain sur smartphone |

---

## Conclusion

Contract Pilot est un outil **fonctionnellement complet** pour son périmètre cible. La stack choisie (Next.js + Prisma + PostgreSQL + Docker) est **cohérente et maintenable** par n'importe quel développeur web moderne.

**Ce n'est pas une application triviale** — Next.js App Router a une courbe d'apprentissage. Mais c'est un choix industriel standard en 2024–2025, avec une énorme communauté et des ressources abondantes.

**Les risques principaux ne sont pas dans le code mais dans l'infrastructure :** la persistance des fichiers uploadés et les sauvegardes de la base de données sont les deux points à adresser en priorité avant tout déploiement critique.

Pour un déploiement interne sur serveur d'entreprise avec une équipe de 5 à 50 utilisateurs, cette architecture est **parfaitement adaptée** et ne nécessite pas de changements majeurs.

---

*Document généré le 19 mai 2026 — Contract Pilot v1.0*
