#!/usr/bin/env bash
set -euo pipefail

SQLCMD="/opt/mssql-tools/bin/sqlcmd"
if [ -x "/opt/mssql-tools18/bin/sqlcmd" ]; then
  SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
fi

run_sql() {
  local query="$1"
  "$SQLCMD" -S battleship-db -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "$query" \
    || "$SQLCMD" -S battleship-db -U sa -P "$MSSQL_SA_PASSWORD" -Q "$query"
}

for attempt in $(seq 1 90); do
  if run_sql "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 90 ]; then
    echo "SQL Server did not become ready in time"
    exit 1
  fi
  sleep 2
done

run_sql "IF DB_ID(N'battleship') IS NULL CREATE DATABASE [battleship];"
