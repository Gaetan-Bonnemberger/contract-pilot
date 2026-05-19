#!/usr/bin/env bash
# =============================================================================
# backup.sh — Sauvegarde automatique de la base de données Contract Pilot
#
# Usage :
#   ./scripts/backup.sh                    # sauvegarde manuelle
#   0 2 * * * /opt/contract-pilot/scripts/backup.sh  # cron à 2h00 chaque nuit
#
# Prérequis : le projet doit tourner avec docker-compose
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_CONTAINER="${DB_CONTAINER:-contract-pilot-db}"
DB_USER="${DB_USER:-contractpilot}"
DB_NAME="${DB_NAME:-contractpilot}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"   # Garder 30 jours de sauvegardes
MAX_BACKUPS="${MAX_BACKUPS:-60}"         # Garder au maximum 60 fichiers

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $*${NC}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $*${NC}" >&2; }

# ── Vérifications ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker n'est pas installé ou pas dans le PATH"; exit 1
fi

if ! docker ps --filter "name=${DB_CONTAINER}" --format "{{.Names}}" | grep -q "${DB_CONTAINER}"; then
  err "Le conteneur '${DB_CONTAINER}' n'est pas en cours d'exécution."
  err "Lancez d'abord : docker-compose up -d"
  exit 1
fi

# ── Créer le répertoire de sauvegardes ────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Nom du fichier de sauvegarde ──────────────────────────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

log "Démarrage de la sauvegarde → ${BACKUP_FILE}"

# ── pg_dump + compression gzip ───────────────────────────────────────────────
if docker exec "${DB_CONTAINER}" \
  pg_dump -U "${DB_USER}" "${DB_NAME}" \
  --no-password \
  --format=plain \
  --encoding=UTF8 \
  | gzip > "${BACKUP_FILE}"; then

  SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
  log "✅ Sauvegarde réussie : ${BACKUP_FILE} (${SIZE})"
else
  err "Échec de la sauvegarde !"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# ── Nettoyage des anciennes sauvegardes ───────────────────────────────────────
log "Nettoyage des sauvegardes de plus de ${RETENTION_DAYS} jours…"
DELETED=$(find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
[ "${DELETED}" -gt 0 ] && log "Supprimé ${DELETED} ancienne(s) sauvegarde(s)"

# Limite du nombre total de fichiers
TOTAL=$(find "${BACKUP_DIR}" -name "backup_*.sql.gz" | wc -l)
if [ "${TOTAL}" -gt "${MAX_BACKUPS}" ]; then
  EXCESS=$((TOTAL - MAX_BACKUPS))
  warn "Trop de sauvegardes (${TOTAL}), suppression des ${EXCESS} plus anciennes…"
  find "${BACKUP_DIR}" -name "backup_*.sql.gz" -printf '%T+ %p\n' \
    | sort | head -n "${EXCESS}" | awk '{print $2}' | xargs rm -f
fi

log "Sauvegardes disponibles : $(find "${BACKUP_DIR}" -name "backup_*.sql.gz" | wc -l) fichier(s)"

# ── Restauration (mode --restore) ─────────────────────────────────────────────
if [[ "${1:-}" == "--restore" ]]; then
  if [[ -z "${2:-}" ]]; then
    err "Usage pour restaurer : $0 --restore <fichier_backup.sql.gz>"
    exit 1
  fi
  RESTORE_FILE="$2"
  if [[ ! -f "${RESTORE_FILE}" ]]; then
    err "Fichier introuvable : ${RESTORE_FILE}"
    exit 1
  fi

  warn "⚠️  RESTAURATION en cours depuis ${RESTORE_FILE}"
  warn "Cette opération ÉCRASE toutes les données actuelles !"
  read -r -p "Confirmer ? (tapez OUI) : " CONFIRM
  if [[ "${CONFIRM}" != "OUI" ]]; then
    log "Restauration annulée."
    exit 0
  fi

  log "Restauration…"
  zcat "${RESTORE_FILE}" | docker exec -i "${DB_CONTAINER}" \
    psql -U "${DB_USER}" "${DB_NAME}" --quiet

  log "✅ Restauration terminée depuis ${RESTORE_FILE}"
fi
