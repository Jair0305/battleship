#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "${BATTLESHIP_ROOT:-/opt/battleship}"
# Installed/activated only after the approved production cutover.
test -f .production-active || exit 0
exec 9>backup.lock
flock -n 9 || exit 0
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="$PWD/backups/daily-$stamp"
python3 consistent-backup.py "$backup" >/dev/null
# Re-hash every artifact before declaring success.
(cd "$backup" && sha256sum -c SHA256SUMS >/dev/null)
cp .env "$backup/environment.private"
cp docker-compose.phosrvr.yml nginx.conf "$backup/"
python3 - "$backup" "$stamp" <<'PY'
import json, os, sys
from pathlib import Path
backup, stamp = Path(sys.argv[1]), sys.argv[2]
fingerprints = json.loads((backup / 'fingerprint.json').read_text())
checksums = {line.split(None, 1)[1].strip(): line.split(None, 1)[0] for line in (backup / 'SHA256SUMS').read_text().splitlines()}
result = {'status': 'verified', 'backup': backup.name, 'completed_utc': stamp,
          'tables': len(fingerprints), 'rows': sum(item['rows'] for item in fingerprints),
          'dump_sha256': checksums['battleship.dump'],
          # Logical dump kept on this host only; no off-host copy is made by this script.
          'custody': 'local-only'}
target = backup.parent / 'last-daily.public.json'
temporary = target.with_suffix('.tmp')
temporary.write_text(json.dumps(result, indent=2) + '\n')
os.replace(temporary, target)
PY
# Retention and off-host destination must be agreed before deleting any backup.
