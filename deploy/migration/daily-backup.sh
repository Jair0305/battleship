#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/battleship
# Installed/activated only after the approved production cutover.
test -f .production-active || exit 0
exec 9>backup.lock
flock -n 9 || exit 0
backup="/opt/battleship/backups/daily-$(date -u +%Y%m%dT%H%M%SZ)"
python3 consistent-backup.py "$backup"
cp .env "$backup/environment.private"
cp docker-compose.phosrvr.yml nginx.conf "$backup/"
# Retention and off-host destination must be agreed before deleting any backup.
