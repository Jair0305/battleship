#!/usr/bin/env bash
# Scan only explicitly supplied images. No runtime changes or secret scanner.
set -euo pipefail
# A caller's Trivy environment/config must not narrow collection or hide findings.
while IFS= read -r name; do unset "$name"; done < <(compgen -v TRIVY_)
export TRIVY_CONFIG=/dev/null
output=${1:?Usage: scan-images.sh OUTPUT_DIRECTORY IMAGE...}
shift
test "$#" -gt 0
umask 077
mkdir -p "$output/tools" "$output/cache" "$output/reports"
case "$(uname -m)" in
  aarch64|arm64) artifact=Linux-ARM64; digest=e174dff2a6dba5e3ae41f8d0537a6324405bd08132497340304c6b20e0f16a1f ;;
  x86_64|amd64) artifact=Linux-64bit; digest=c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 ;;
  *) echo 'Unsupported scanner architecture' >&2; exit 1 ;;
esac
tool="$output/tools/trivy"
if ! test -x "$tool"; then
  archive="$output/tools/trivy.tar.gz"
  curl --fail --silent --show-error --location --retry 3 \
    "https://github.com/aquasecurity/trivy/releases/download/v0.76.1/trivy_0.76.1_${artifact}.tar.gz" \
    --output "$archive"
  printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status
  tar -xf "$archive" -C "$output/tools" trivy
fi
"$tool" --cache-dir "$output/cache" --version > "$output/reports/scanner-version.txt"
status=0
index=0
for image in "$@"; do
  index=$((index + 1))
  "$tool" image --scanners vuln --ignorefile '' --ignore-unfixed=false \
    --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 0 --format json --list-all-pkgs \
    --cache-dir "$output/cache" --timeout 15m --output "$output/reports/image-$index.json" "$image"
  "$tool" convert --ignorefile '' --format cyclonedx \
    --output "$output/reports/image-$index.cdx.json" "$output/reports/image-$index.json"
  "$tool" convert --ignorefile '' --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1 \
    "$output/reports/image-$index.json" || status=1
done
"$tool" --cache-dir "$output/cache" --version > "$output/reports/scanner-version.txt"
exit "$status"
