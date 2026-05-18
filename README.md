# Contract Pilot

Application web interne de pilotage contractuel des marchés travaux, maintenance et réseaux.  
Développée en Next.js 16, PostgreSQL, et analyse IA via Claude (Anthropic).

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Installation en 3 étapes](#2-installation-en-3-étapes)
3. [Configuration](#3-configuration)
4. [Premier démarrage](#4-premier-démarrage)
5. [Mise à jour de l'application](#5-mise-à-jour-de-lapplication)
6. [Sauvegarde de la base de données](#6-sauvegarde-de-la-base-de-données)
7. [Analyse IA des marchés](#7-analyse-ia-des-marchés)
8. [Rôles et comptes utilisateurs](#8-rôles-et-comptes-utilisateurs)
9. [Fonctionnalités](#9-fonctionnalités)
10. [Résolution de problèmes](#10-résolution-de-problèmes)

---

## 1. Prérequis

| Logiciel | Version minimale | Utilité |
|---|---|---|
| **Docker Desktop** | 24+ | Fait tourner l'application et la base de données |
| **Docker Compose** | v2+ | Inclus dans Docker Desktop |

> ℹ️ Docker Desktop est disponible pour **Windows Server**, **Windows 10/11**, **Ubuntu**, **Debian**, **CentOS**.  
> Téléchargement : https://www.docker.com/products/docker-desktop/

**Ports requis sur le serveur :**
- `3000` — Application web (configurable)
- `5432` — PostgreSQL (uniquement en local, pas besoin d'ouvrir vers l'extérieur)

---

## 2. Installation en 3 étapes

### Étape 1 — Récupérer les fichiers

```bash
git clone https://github.com/Gaetan-Bonnemberger/contract-pilot.git
cd contract-pilot
```

Ou télécharger l'archive ZIP depuis GitHub et l'extraire sur le serveur.

---

### Étape 2 — Créer le fichier de configuration

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env avec les vraies valeurs
nano .env    # ou notepad .env sous Windows
```

**Valeurs obligatoires à modifier dans `.env` :**

| Variable | Description | Exemple |
|---|---|---|
| `DB_PASSWORD` | Mot de passe base de données | `MonMotDePasse2024!` |
| `NEXTAUTH_SECRET` | Clé de chiffrement des sessions | Générer avec `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL complète du serveur | `http://192.168.1.50:3000` |

---

### Étape 3 — Lancer l'application

```bash
docker-compose up -d
```

Cette commande :
1. Télécharge les images Docker nécessaires (~5 min la première fois)
2. Démarre la base de données PostgreSQL
3. Compile et démarre l'application
4. Applique automatiquement les migrations de base de données

L'application est accessible sur **http://[IP_DU_SERVEUR]:3000**

---

## 3. Configuration

### Variables d'environnement complètes (fichier `.env`)

```env
# ── Base de données ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://contractpilot:VOTRE_MOT_DE_PASSE@postgres:5432/contractpilot
DB_PASSWORD=VOTRE_MOT_DE_PASSE

# ── Authentification (OBLIGATOIRE) ─────────────────────────────────────────
NEXTAUTH_SECRET=GENERER_AVEC_openssl_rand_-base64_32
NEXTAUTH_URL=http://192.168.1.50:3000   ← Adresse IP ou nom de domaine du serveur

# ── Port de l'application ──────────────────────────────────────────────────
APP_PORT=3000                            # Changer si le port 3000 est occupé

# ── IA — Analyse automatique des marchés (optionnel) ─────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...       # Laisser vide pour le mode démo

# ── Email — Notifications (optionnel) ─────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@monentreprise.fr
SMTP_PASS=mot-de-passe-application
EMAIL_FROM="Contract Pilot <notifications@monentreprise.fr>"
```

### Générer un secret fort

```bash
# Sous Linux/Mac
openssl rand -base64 32

# Sous Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## 4. Premier démarrage

### Peupler la base de données avec les données initiales

Après le premier `docker-compose up -d`, lancer le script de seed :

```bash
docker exec contract-pilot-app npm run db:seed
```

Cela crée :
- Les référentiels de clauses, KPIs et documents types
- Les modèles de scoring par défaut
- Les comptes utilisateurs de démonstration (voir ci-dessous)

### Comptes de démonstration

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@comelec.local` | `password123` | Administrateur |
| `marche@comelec.local` | `password123` | Responsable Marché |
| `qse@comelec.local` | `password123` | QSE |

> ⚠️ **Changer ces mots de passe en production** depuis l'interface d'administration.

---

## 5. Mise à jour de l'application

```bash
# 1. Récupérer la nouvelle version
git pull origin master

# 2. Reconstruire et redémarrer
docker-compose up -d --build

# 3. Appliquer les nouvelles migrations (si le schéma a changé)
docker exec contract-pilot-app npx prisma db push
```

---

## 6. Sauvegarde de la base de données

### Sauvegarde manuelle

```bash
# Exporter la base (remplacer VOTRE_MOT_DE_PASSE)
docker exec contract-pilot-db pg_dump -U contractpilot contractpilot > backup_$(date +%Y%m%d).sql
```

### Restauration

```bash
# Restaurer depuis une sauvegarde
cat backup_20241201.sql | docker exec -i contract-pilot-db psql -U contractpilot contractpilot
```

### Sauvegarde automatique (recommandé)

Ajouter une tâche planifiée (cron sous Linux, Tâches planifiées sous Windows) :

```bash
# Exemple : sauvegarde quotidienne à 2h du matin (Linux cron)
0 2 * * * docker exec contract-pilot-db pg_dump -U contractpilot contractpilot > /backups/contract-pilot/backup_$(date +\%Y\%m\%d).sql
```

### Les fichiers uploadés

Les documents contractuels sont stockés dans le volume Docker `storage_data`.  
Pour les sauvegarder :

```bash
docker cp contract-pilot-app:/app/storage ./backup-storage
```

---

## 7. Analyse IA des marchés

L'IA analyse automatiquement les documents contractuels uploadés (PDF, Word).  
Elle extrait les clauses, KPIs et obligations, qui sont ensuite validés manuellement.

### Sans clé API (mode démo)
L'application fonctionne normalement avec des résultats d'analyse de démonstration.  
Aucune connexion externe n'est requise.

### Avec clé API Anthropic (analyse réelle)

1. Créer un compte sur https://console.anthropic.com
2. Générer une clé API (`sk-ant-api03-...`)
3. Ajouter dans le fichier `.env` :
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-votre-cle-ici
   ```
4. Redémarrer : `docker-compose restart app`

**Comment ça fonctionne :**
1. Le responsable fait un glisser-déposer du PDF du marché sur l'onglet "Analyse IA"
2. Le texte est extrait côté serveur
3. Claude analyse le document et identifie clauses, KPIs, obligations, risques
4. Le responsable valide ou corrige l'analyse avant application

**Coût estimé :** ~0,05 € par analyse de marché (modèle Claude Opus).

---

## 8. Rôles et comptes utilisateurs

| Rôle | Accès |
|---|---|
| **ADMIN** | Accès total, gestion des utilisateurs, paramètres |
| **DIRECTEUR** | Lecture de tous les marchés, journal d'audit, digest email |
| **RESPONSABLE_MARCHE** | Gestion complète de ses marchés |
| **EXPLOITATION** | Saisie des chantiers et documents |
| **QSE** | Saisie des non-conformités QHSE |
| **LECTURE** | Consultation uniquement |

---

## 9. Fonctionnalités

| Module | Description |
|---|---|
| **Dashboard** | Vue globale de tous les marchés avec scores de santé |
| **Gestion des marchés** | CRUD complet, onglets spécialisés par domaine |
| **Analyse IA** | Lecture automatique du PDF du marché par Claude |
| **Clauses & KPIs** | Extraction et suivi des indicateurs contractuels |
| **Chantiers** | Suivi AAT/PAT/topo/touret par commande |
| **Alertes automatiques** | 6 types d'alertes générées automatiquement |
| **Score santé** | Score 0-100 sur 8 métriques pondérables par marché |
| **Avenants** | Suivi des modifications contractuelles avec cumul financier |
| **NC QHSE** | Non-conformités avec impact automatique sur le score |
| **Défense de marché** | Justifications par indicateur + export PDF |
| **Journal d'audit** | Traçabilité complète de toutes les actions |
| **Notifications email** | Alertes critiques + récapitulatif quotidien |
| **Plan d'action** | Kanban de suivi des actions correctives |
| **Export** | Excel multi-onglets par marché |

---

## 10. Résolution de problèmes

### L'application ne démarre pas

```bash
# Voir les logs
docker-compose logs -f app

# Voir les logs de la base de données
docker-compose logs -f postgres
```

### Erreur de connexion à la base de données

Vérifier que le container PostgreSQL est bien démarré :
```bash
docker-compose ps
```
Si `postgres` est en erreur, vérifier le mot de passe dans `.env`.

### Réinitialiser complètement (⚠️ supprime toutes les données)

```bash
docker-compose down -v   # Supprime les containers ET les volumes
docker-compose up -d     # Repart de zéro
docker exec contract-pilot-app npm run db:seed
```

### Changer l'URL du serveur

Modifier `NEXTAUTH_URL` dans `.env` puis redémarrer :
```bash
docker-compose restart app
```

### Les emails ne partent pas

Vérifier que `SMTP_USER` et `SMTP_PASS` sont configurés dans `.env`.  
Pour Gmail, le `SMTP_PASS` doit être un **mot de passe d'application** (pas le mot de passe du compte).  
Générer sur : https://myaccount.google.com/apppasswords (nécessite la validation en 2 étapes activée).

---

## Architecture technique

```
contract-pilot/
├── docker-compose.yml          # Orchestration des containers
├── Dockerfile                  # Build de l'image de l'application
├── .env.example                # Modèle de configuration (copier en .env)
├── prisma/
│   └── schema.prisma           # Schéma de base de données
└── src/
    ├── app/
    │   ├── (app)/              # Pages de l'application (protégées)
    │   │   ├── markets/        # Gestion des marchés
    │   │   ├── dashboard/      # Tableau de bord
    │   │   ├── audit/          # Journal d'audit
    │   │   └── settings/       # Paramètres (scoring, email…)
    │   ├── api/                # API REST interne
    │   └── login/              # Page de connexion
    └── lib/
        ├── auth.ts             # Authentification (NextAuth)
        ├── prisma.ts           # Connexion base de données
        ├── score.ts            # Calcul du score santé
        ├── alerts.ts           # Génération automatique des alertes
        ├── llm.ts              # Analyse IA (Claude / mode démo)
        ├── audit.ts            # Journal d'audit (non-bloquant)
        ├── email.ts            # Envoi d'emails (SMTP)
        ├── nc.ts               # Impact NC QHSE sur les KPIs
        └── permissions.ts      # Contrôle d'accès par rôle
```

---

*Contract Pilot — Pilotage contractuel des marchés travaux*
