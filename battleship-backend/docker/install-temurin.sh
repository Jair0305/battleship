#!/bin/sh
set -eu
kind=$1
arch=$2
destination=$3
case "$kind:$arch" in
  jdk:arm64) vendor_arch=aarch64; digest=a41f2d7b886ed318db51543cd045d94dd35179f66df302e6c3fd48a41a6dd9f5 ;;
  jre:arm64) vendor_arch=aarch64; digest=382633eb2ba28cc5b97be1446eb1dd8d2a60a3795be0166a030e4cda338c490e ;;
  jdk:amd64) vendor_arch=x64; digest=dc453842ee3f24710258f42a95bdfe5c2bfc0ca9d70c12f950ead82aee0c8361 ;;
  jre:amd64) vendor_arch=x64; digest=9138eab0f7d230e17163953f015ec9ae2431dbc49069c658b7f991e45b54fb9b ;;
  *) echo 'Unsupported Temurin artifact' >&2; exit 1 ;;
esac
archive=/tmp/temurin.tar.gz
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-${kind}_${vendor_arch}_alpine-linux_hotspot_21.0.13_9.tar.gz" \
  --output "$archive"
printf '%s  %s\n' "$digest" "$archive" | sha256sum -cs
mkdir -p "$destination"
tar -xzf "$archive" --strip-components=1 -C "$destination"
rm "$archive"
sh "$(dirname "$0")/patch-java-trust.sh" "$destination"
"$destination/bin/java" -version
