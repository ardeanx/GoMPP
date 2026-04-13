#!/usr/bin/env bash
#
# GoMPP Restore Script
# Restores a PostgreSQL database and storage directory from a backup.
#
# Usage:
#   ./scripts/restore.sh ./backups/20250101_120000
#   PGHOST=db ./scripts/restore.sh ./backups/20250101_120000
#
# Environment variables:
#   PGHOST           - PostgreSQL host (default: localhost)
#   PGPORT           - PostgreSQL port (default: 5432)
#   PGUSER           - PostgreSQL user (default: gompp)
#   PGPASSWORD       - PostgreSQL password (default: gompp)
#   PGDATABASE       - Database name (default: gompp)
#   STORAGE_PATH     - Local storage directory (default: ./data)
#
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-directory>"
  echo "Example: $0 ./backups/20250101_120000"
  exit 1
fi

BACKUP_SUBDIR="$1"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-gompp}"
PGDATABASE="${PGDATABASE:-gompp}"
STORAGE_PATH="${STORAGE_PATH:-./data}"

# Validate backup directory
if [ ! -d "${BACKUP_SUBDIR}" ]; then
  echo "Error: Backup directory not found: ${BACKUP_SUBDIR}"
  exit 1
fi

if [ ! -f "${BACKUP_SUBDIR}/database.dump" ]; then
  echo "Error: database.dump not found in ${BACKUP_SUBDIR}"
  exit 1
fi

if [ -f "${BACKUP_SUBDIR}/manifest.json" ]; then
  echo "=== Backup Manifest ==="
  cat "${BACKUP_SUBDIR}/manifest.json"
  echo ""
fi

echo "=== GoMPP Restore ==="
echo "Restoring from: ${BACKUP_SUBDIR}"
echo "Target database: ${PGDATABASE}@${PGHOST}:${PGPORT}"
echo "Target storage:  ${STORAGE_PATH}"
echo ""

read -rp "This will OVERWRITE the current database and storage. Continue? [y/N] " CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

# Database restore
echo "[1/2] Restoring PostgreSQL database..."

# Drop and recreate the database
PGPASSWORD="${PGPASSWORD:-gompp}" dropdb \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  --if-exists \
  "${PGDATABASE}"

PGPASSWORD="${PGPASSWORD:-gompp}" createdb \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  "${PGDATABASE}"

PGPASSWORD="${PGPASSWORD:-gompp}" pg_restore \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  "${BACKUP_SUBDIR}/database.dump" || true

echo "  Database restored."

# Storage restore
echo "[2/2] Restoring storage directory..."
if [ -f "${BACKUP_SUBDIR}/storage.tar.gz" ]; then
  mkdir -p "${STORAGE_PATH}"
  rm -rf "${STORAGE_PATH:?}/"*
  tar -xzf "${BACKUP_SUBDIR}/storage.tar.gz" -C "$(dirname "${STORAGE_PATH}")"
  STORAGE_SIZE=$(du -sh "${STORAGE_PATH}" | cut -f1)
  echo "  Storage restored: ${STORAGE_SIZE}"
else
  echo "  No storage archive found, skipping."
fi

echo ""
echo "=== Restore complete ==="
echo "Database: ${PGDATABASE}"
echo "Storage:  ${STORAGE_PATH}"
