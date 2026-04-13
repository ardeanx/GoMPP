#!/usr/bin/env bash
#
# GoMPP Backup Script
# Creates a timestamped backup of the PostgreSQL database and storage directory.
#
# Usage:
#   ./scripts/backup.sh                     # backup to ./backups/
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh
#
# Environment variables:
#   BACKUP_DIR       - Destination directory (default: ./backups)
#   PGHOST           - PostgreSQL host (default: localhost)
#   PGPORT           - PostgreSQL port (default: 5432)
#   PGUSER           - PostgreSQL user (default: gompp)
#   PGPASSWORD       - PostgreSQL password (default: gompp)
#   PGDATABASE       - Database name (default: gompp)
#   STORAGE_PATH     - Local storage directory (default: ./data)
#   RETENTION_DAYS   - Days to keep old backups (default: 30)
#
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-gompp}"
PGDATABASE="${PGDATABASE:-gompp}"
STORAGE_PATH="${STORAGE_PATH:-./data}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

BACKUP_SUBDIR="${BACKUP_DIR}/${TIMESTAMP}"

echo "=== GoMPP Backup ==="
echo "Timestamp:  ${TIMESTAMP}"
echo "Backup dir: ${BACKUP_SUBDIR}"
echo ""

mkdir -p "${BACKUP_SUBDIR}"

# Database backup
echo "[1/3] Dumping PostgreSQL database..."
PGPASSWORD="${PGPASSWORD:-gompp}" pg_dump \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  -Fc \
  --no-owner \
  --no-privileges \
  -f "${BACKUP_SUBDIR}/database.dump"

DB_SIZE=$(du -sh "${BACKUP_SUBDIR}/database.dump" | cut -f1)
echo "  Database dump: ${DB_SIZE}"

# Storage backup
echo "[2/3] Backing up storage directory..."
if [ -d "${STORAGE_PATH}" ]; then
  tar -czf "${BACKUP_SUBDIR}/storage.tar.gz" -C "$(dirname "${STORAGE_PATH}")" "$(basename "${STORAGE_PATH}")"
  STORAGE_SIZE=$(du -sh "${BACKUP_SUBDIR}/storage.tar.gz" | cut -f1)
  echo "  Storage archive: ${STORAGE_SIZE}"
else
  echo "  Storage directory not found at ${STORAGE_PATH}, skipping."
fi

# Cleanup old backups
echo "[3/3] Cleaning up backups older than ${RETENTION_DAYS} days..."
REMOVED=$(find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} \; | wc -l)
echo "  Removed ${REMOVED} old backup(s)."

# Summary
TOTAL_SIZE=$(du -sh "${BACKUP_SUBDIR}" | cut -f1)
echo ""
echo "=== Backup complete ==="
echo "Location: ${BACKUP_SUBDIR}"
echo "Total size: ${TOTAL_SIZE}"
echo ""

# Write manifest
cat > "${BACKUP_SUBDIR}/manifest.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "database": "${PGDATABASE}",
  "host": "${PGHOST}",
  "has_storage": $([ -f "${BACKUP_SUBDIR}/storage.tar.gz" ] && echo "true" || echo "false"),
  "version": "1.0"
}
EOF

echo "Manifest written to ${BACKUP_SUBDIR}/manifest.json"
