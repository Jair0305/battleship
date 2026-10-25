#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/battleship
test "$(uname -m)" = aarch64
test -f .production-active
test -f .env
revision=${1:?Git revision required}
actor=${2:?Registry actor required}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
[[ "$actor" =~ ^[A-Za-z0-9_-]+$ ]]
candidate="/opt/battleship/incoming/$revision"
test -f "$candidate/docker-compose.phosrvr.yml"
exec 9>deploy.lock
flock -n 9 || { echo 'Another Battleship deployment is running'; exit 1; }
grep -qx 'BATTLESHIP_POSTGRES_VOLUME=battleship_postgres_data' .env

# The token arrives only on stdin and is removed after the pull.
DOCKER_CONFIG=$(mktemp -d /opt/battleship/.docker-ci.XXXXXX)
export DOCKER_CONFIG
trap 'rm -f -- "$DOCKER_CONFIG/config.json"; rmdir -- "$DOCKER_CONFIG"' EXIT
docker login ghcr.io -u "$actor" --password-stdin
backend="ghcr.io/jair0305/battleship-backend:${revision}-arm64"
frontend="ghcr.io/jair0305/battleship-frontend:${revision}-arm64"
database="ghcr.io/jair0305/battleship-postgres:${revision}-arm64"
proxy="ghcr.io/jair0305/battleship-nginx:${revision}-arm64"
docker pull "$backend"
docker pull "$frontend"
docker pull "$database"
docker pull "$proxy"
for image in "$backend" "$frontend" "$database" "$proxy"; do
  test "$(docker image inspect "$image" --format '{{.Architecture}}')" = arm64
done

# Check before and after closing ingress to avoid a game starting during the check.
active_games() {
  docker exec battleship-db psql -X -At -U battleship -d battleship -c "SELECT (SELECT count(*) FROM partida WHERE estado IN ('PLACING_SHIPS','READY_TO_START','IN_PROGRESS','EN_CURSO')) + (SELECT count(*) FROM mesa WHERE ready_deadline_at IS NOT NULL);"
}
test "$(active_games)" = 0 || { echo 'Active games exist; retry after they finish'; exit 1; }
BACKEND_IMAGE="$backend" FRONTEND_IMAGE="$frontend" DATABASE_IMAGE="$database" PROXY_IMAGE="$proxy" \
  docker compose --project-directory /opt/battleship --env-file .env -f "$candidate/docker-compose.phosrvr.yml" config -q
docker stop battleship-nginx
if [ "$(active_games)" != 0 ]; then
  docker start battleship-nginx
  echo 'A game started while closing ingress; deployment deferred'
  exit 1
fi
# No new HTTP/WS requests; stopping the backend also freezes its scheduled writes.
docker stop --time 60 battleship-backend
if [ "$(active_games)" != 0 ]; then
  # An already accepted request can commit after ingress closes. Resume the old
  # application rather than carry a live game through a deployment.
  docker start battleship-backend
  resumed=false
  for attempt in $(seq 1 60); do
    if curl -fsS --connect-timeout 2 --max-time 5 http://127.0.0.1:3007/api/lobby >/dev/null; then
      resumed=true
      break
    fi
    sleep 2
  done
  test "$resumed" = true || { echo 'Previous backend failed to resume; ingress remains paused'; exit 1; }
  docker start battleship-nginx
  echo 'In-flight activity committed before shutdown; deployment deferred'
  exit 1
fi
echo 'Battleship ingress is paused until the new application passes startup checks'
backup="/opt/battleship/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:7}"
python3 "$candidate/consistent-backup.py" "$backup"
cp .env "$backup/environment.private"
cp docker-compose.phosrvr.yml nginx.conf "$backup/"
cp "$candidate/docker-compose.phosrvr.yml" "$candidate/nginx.conf" .
cp "$candidate/consistent-backup.py" "$candidate/database-fingerprint.sql" .
python3 - "$backend" "$frontend" "$database" "$proxy" <<'PY'
import os
from pathlib import Path
import sys
p = Path('.env')
lines = [line for line in p.read_text().splitlines()
         if not line.startswith(('BACKEND_IMAGE=', 'FRONTEND_IMAGE=', 'DATABASE_IMAGE=', 'PROXY_IMAGE='))]
lines += [key + '=' + value for key, value in zip(
    ['BACKEND_IMAGE', 'FRONTEND_IMAGE', 'DATABASE_IMAGE', 'PROXY_IMAGE'], sys.argv[1:])]
tmp = Path('.env.next')
tmp.write_text('\n'.join(lines) + '\n')
tmp.chmod(0o600)
os.replace(tmp, p)
PY
docker compose --env-file .env -f docker-compose.phosrvr.yml config -q
docker compose --env-file .env -f docker-compose.phosrvr.yml up -d db backend frontend
healthy=false
for attempt in $(seq 1 60); do
  if curl -fsS --connect-timeout 2 --max-time 5 http://127.0.0.1:3007/api/lobby >/dev/null && docker exec battleship-frontend node -e 'fetch("http://127.0.0.1:3000",{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
    healthy=true
    break
  fi
  sleep 2
done
test "$healthy" = true || { echo 'Startup failed; ingress remains paused. Use the recorded recovery backup.'; exit 1; }
docker compose --env-file .env -f docker-compose.phosrvr.yml up -d nginx
# Nginx resolves upstream container addresses at configuration load time.
docker exec battleship-nginx nginx -t
docker exec battleship-nginx nginx -s reload
printf 'Deployed ARM64 revision %s; recovery backup %s\n' "$revision" "$backup"
