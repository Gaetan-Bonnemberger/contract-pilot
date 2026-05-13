# Contract Pilot

Application web interne de pilotage contractuel des marchés travaux, maintenance et réseaux.

## Prérequis

- **Node.js 20+**
- **Docker Desktop** (pour PostgreSQL)

## Démarrage rapide

### 1. Lancer la base de données

```bash
docker-compose up -d postgres
```

Attendre ~10 secondes que PostgreSQL soit prêt.

### 2. Installer les dépendances

```bash
npm install
```

### 3. Créer et migrer la base

```bash
npx prisma migrate dev --name init
```

### 4. Remplir avec les données de démo

```bash
npm run db:seed
```

### 5. Lancer l'application

```bash
npm run dev
```

Ouvrir http://localhost:3000

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@comelec.local | password123 | Admin |
| marche@comelec.local | password123 | Responsable Marché |
| qse@comelec.local | password123 | QSE |

---

## Structure du projet

```
src/
  app/
    (app)/            # Layout applicatif (sidebar + auth)
      dashboard/      # Dashboard global
      markets/        # Liste et création marchés
        [marketId]/   # Fiche marché avec onglets
          overview/   # Vue d'ensemble + score santé
          analysis/   # Analyse IA + validation
          clauses/    # Clauses contractuelles
          kpis/       # Indicateurs de performance
          obligations/ # Obligations contractuelles
          projects/   # Chantiers / commandes
          documents/  # Documents chantiers
          alerts/     # Alertes + recalcul
          actions/    # Plan d'action (kanban)
          exports/    # Export Excel / PDF
      settings/       # Référentiels (clauses, KPIs, docs, scoring)
    api/              # API routes
    login/            # Page de connexion
  lib/
    prisma.ts         # Client Prisma singleton
    auth.ts           # NextAuth configuration
    permissions.ts    # Gestion des rôles
    score.ts          # Calcul du score santé
    alerts.ts         # Recalcul des alertes
    llm.ts            # Analyse IA (Claude ou mock)
    storage.ts        # Stockage fichiers
```

---

## Fonctionnalités MVP

- Authentification avec 6 rôles
- CRUD marchés
- Upload de documents contractuels
- Analyse IA (Claude ou mock réaliste)
- Validation humaine obligatoire de l'analyse
- Clauses, KPIs, obligations
- Chantiers avec AAT/PAT/topo/touret
- Documents par chantier
- Événements (pénalités, bonus, incidents)
- Alertes automatiques (8 types)
- Recalcul des alertes à la demande
- Score santé pondéré (8 métriques)
- Dashboard global
- Plan d'action (kanban)
- Export Excel multi-onglets
- Permissions serveur par rôle

---

## Variables d'environnement

```env
DATABASE_URL=postgresql://contractpilot:contractpilot@localhost:5432/contractpilot
NEXTAUTH_SECRET=votre-secret-ici
NEXTAUTH_URL=http://localhost:3000
STORAGE_PATH=./storage
ANTHROPIC_API_KEY=           # Optionnel — mock si absent
```

---

## Déploiement Docker complet

```bash
docker-compose up -d
```

Lance PostgreSQL + l'application sur le port 3000.

---

## Alertes générées automatiquement

| Type | Déclencheur | Gravité |
|------|------------|---------|
| URGENCE_HORS_DELAI | Intervention urgente en retard | CRITIQUE |
| TOPO_MANQUANT | Topo requis non remis > 2j | CRITIQUE |
| TOURET_NON_RECUPERE | AAT + 75j sans récupération touret | MAJEUR |
| DOCUMENT_MANQUANT | Document obligatoire en retard | MAJEUR/CRITIQUE |
| NOTE_SECURITE_SOUS_SEUIL | Note sécurité < seuil contractuel | CRITIQUE |
| NOTE_QUALITE_SOUS_SEUIL | Note qualité < seuil contractuel | MAJEUR |

---

## Score santé — Pondérations

| Métrique | Poids |
|---------|-------|
| Délais | 20% |
| Sécurité | 20% |
| Qualité | 15% |
| Documents | 15% |
| Réception | 10% |
| Pénalités/Écarts | 10% |
| Alertes/Risques | 5% |
| Bonus/Opportunités | 5% |
