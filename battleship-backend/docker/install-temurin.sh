#!/bin/sh
set -eu
kind=$1
arch=$2
destination=$3
case "$kind:$arch" in
  jdk:arm64) vendor_arch=aarch64; digest=e3522e707fc7dbe2a72c30746b1e7068301a0213ecd213d4491f35a14eb55578 ;;
  jre:arm64) vendor_arch=aarch64; digest=b1734db7ade49c3f6acc6ae06233b8c2dd90e3e2f00f67000ae1c972aaa64d8c ;;
  jdk:amd64) vendor_arch=x64; digest=d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c ;;
  jre:amd64) vendor_arch=x64; digest=a535a1df9c6284d9618872984e026ae0352d1f7e9e0605425c0e6114f47351dd ;;
  *) echo 'Unsupported Temurin artifact' >&2; exit 1 ;;
esac
archive=/tmp/temurin.tar.gz
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-${kind}_${vendor_arch}_linux_hotspot_21.0.13_9.tar.gz" \
  --output "$archive"
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status
mkdir -p "$destination"
tar -xzf "$archive" --strip-components=1 -C "$destination"
rm "$archive"
sh "$(dirname "$0")/patch-java-trust.sh" "$destination"
"$destination/bin/java" -version
