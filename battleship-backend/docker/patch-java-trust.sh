#!/bin/sh
# Apply the published CVE-2026-91403 intermediate blocklist to this runtime only.
set -eu
java_directory=${1:?Java home required}
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
blocked="$java_directory/lib/security/blocked.certs"
test -f "$blocked"
grep -qx 'Algorithm=SHA-256' "$blocked"
count=0
while IFS= read -r fingerprint || test -n "$fingerprint"; do
    case "$fingerprint" in ''|'#'*) continue ;; *[!A-F0-9]*) exit 1 ;; esac
    test "${#fingerprint}" -eq 64
    if ! grep -Fxq "$fingerprint" "$blocked"; then
        printf '\n%s\n' "$fingerprint" >> "$blocked"
    fi
    count=$((count + 1))
done < "$script_directory/blocked-cert-fingerprints.txt"
test "$count" -eq 16
printf 'Java trust: %s compromised certificate fingerprints blocked\n' "$count"
