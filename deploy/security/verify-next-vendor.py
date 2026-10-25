#!/usr/bin/env python3
"""Match every packaged Next RSC variant to the lockfile's official npm artifact.

This verifies artifact identity. Advisory applicability still needs source review;
React's client version and the vendored canary label are insufficient evidence.
"""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("lockfile", type=Path)
    args = parser.parse_args()
    package = json.loads(args.lockfile.read_text())["packages"]["node_modules/next"]
    url = urllib.parse.urlsplit(package["resolved"])
    if url.scheme != "https" or url.hostname != "registry.npmjs.org":
        raise RuntimeError("Expected the official npm registry artifact")
    algorithm, expected = package["integrity"].split("-", 1)
    if algorithm != "sha512":
        raise RuntimeError("Expected a SHA-512 lockfile integrity value")
    with urllib.request.urlopen(package["resolved"], timeout=120) as response:
        data = response.read()
    if base64.b64encode(hashlib.sha512(data).digest()).decode() != expected:
        raise RuntimeError("Official artifact failed lockfile integrity verification")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        members = [m for m in archive.getmembers() if m.isfile()
                   and m.name.startswith("package/dist/compiled/react-server-dom-")]
        if not members:
            raise RuntimeError("No vendored RSC files found in the official artifact")
        directories = sorted({m.name.split("/")[3] for m in members})
        packaged = json.loads(subprocess.check_output([
            "docker", "run", "--rm", "--network", "none", "--memory", "128m", "--cpus", "0.5",
            "--entrypoint", "node", args.image, "-e",
            "console.log(JSON.stringify(require('node:fs').readdirSync('/app/node_modules/next/dist/compiled')"
            ".filter(name=>name.startsWith('react-server-dom-')).sort()))"
        ], text=True))
        if packaged != directories:
            raise RuntimeError("Unexpected or missing packaged RSC variants")
        container = subprocess.check_output(["docker", "create", args.image], text=True).strip()
        try:
            with tempfile.TemporaryDirectory(prefix="battleship-rsc-") as temporary:
                root = Path(temporary)
                for directory in directories:
                    subprocess.run(["docker", "cp", container + ":/app/node_modules/next/dist/compiled/"
                                    + directory, str(root / directory)], check=True,
                                   stdout=subprocess.DEVNULL)
                expected_files = set()
                manifest = []
                for member in sorted(members, key=lambda m: m.name):
                    relative = member.name.removeprefix("package/dist/compiled/")
                    expected_files.add(relative)
                    official = archive.extractfile(member).read()
                    actual = (root / relative).read_bytes()
                    if actual != official:
                        raise RuntimeError("Packaged RSC differs from npm artifact: " + relative)
                    manifest.append(relative + "\0" + hashlib.sha256(actual).hexdigest())
                actual_files = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
                if expected_files != actual_files:
                    raise RuntimeError("Unexpected or missing packaged RSC files")
        finally:
            subprocess.run(["docker", "rm", container], check=True, stdout=subprocess.DEVNULL)
    print(json.dumps({"next": package["version"], "variants": directories, "files": len(members),
                      "official_tarball_sha256": hashlib.sha256(data).hexdigest(),
                      "bundle_manifest_sha256": hashlib.sha256("\n".join(manifest).encode()).hexdigest(),
                      "status": "matches-official-lockfile-artifact"}))


if __name__ == "__main__":
    main()
