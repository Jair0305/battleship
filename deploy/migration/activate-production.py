#!/usr/bin/env python3
"""Validate the exact Battleship production contract and, only with --apply, create
the CD activation marker. Never prints secrets or tokens.

  sudo python3 activate-production.py --receipt RECEIPT.public.json [--apply]

Checks: aarch64 host, .env contract, four running containers on the .env images
with the authority volume, the DATA_READY receipt, a FRESH consistent backup and
its restore into a throwaway database with identical fingerprints."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import subprocess
import sys
import time

VOLUME = "battleship_postgres_data"
IMAGE_KEYS = {"BACKEND_IMAGE": "backend", "FRONTEND_IMAGE": "frontend",
              "DATABASE_IMAGE": "postgres", "PROXY_IMAGE": "nginx"}
CONTAINERS = {"BACKEND_IMAGE": "battleship-backend", "FRONTEND_IMAGE": "battleship-frontend",
              "DATABASE_IMAGE": "battleship-db", "PROXY_IMAGE": "battleship-nginx"}
IMAGE_PATTERN = r"ghcr\.io/jair0305/battleship-{}(@sha256:[0-9a-f]{{64}}|:[0-9a-f]{{40}}-arm64)"


def parse_env(text):
    return dict(line.split("=", 1) for line in text.splitlines() if "=" in line and not line.startswith("#"))


def check_env(env):
    problems = []
    if env.get("BATTLESHIP_POSTGRES_VOLUME") != VOLUME:
        problems.append("BATTLESHIP_POSTGRES_VOLUME must be " + VOLUME)
    if not env.get("POSTGRES_PASSWORD"):
        problems.append("POSTGRES_PASSWORD missing")
    for key, component in IMAGE_KEYS.items():
        if not re.fullmatch(IMAGE_PATTERN.format(component), env.get(key, "")):
            problems.append(key + " is not an exact Battleship ARM64 reference")
    return problems


def verify_backup(directory):
    """Re-hash every artifact and require a non-empty fingerprint set."""
    directory = Path(directory)
    names = []
    for line in (directory / "SHA256SUMS").read_text().splitlines():
        expected, name = line.split(None, 1)
        name = name.strip()
        if hashlib.sha256((directory / name).read_bytes()).hexdigest() != expected:
            raise ValueError("Checksum mismatch: " + name)
        names.append(name)
    if sorted(names) != ["battleship.dump", "fingerprint.json", "globals.private.sql"]:
        raise ValueError("Backup artifacts incomplete")
    fingerprints = json.loads((directory / "fingerprint.json").read_text())
    if not fingerprints or any(not {"table", "rows", "content_md5"} <= set(item) for item in fingerprints):
        raise ValueError("Fingerprint file invalid")
    return sorted(fingerprints, key=lambda item: item["table"])


def build_marker(env, receipt_sha256, backup, restore_rows, now):
    return {"contract_version": 1, "status": "active", "activated_utc": now,
            "authority": {"host": "phosrvr", "volume": VOLUME},
            "images": {key: env[key] for key in IMAGE_KEYS},
            "receipt_sha256": receipt_sha256, "backup": backup,
            "restore_test": {"status": "passed", "rows": restore_rows},
            "offhost_backup": "not-configured"}


def valid_marker(text):
    try:
        marker = json.loads(text)
    except ValueError:
        return False
    return (isinstance(marker, dict) and marker.get("contract_version") == 1 and marker.get("status") == "active"
            and marker.get("authority") == {"host": "phosrvr", "volume": VOLUME})


def docker(*args, text_in=None, file_in=None):
    options = {"input": text_in} if text_in is not None else {"stdin": file_in or subprocess.DEVNULL}
    result = subprocess.run(["docker", *args], capture_output=True, text=file_in is None, timeout=300, **options)
    if result.returncode:
        raise RuntimeError("docker " + args[0] + " failed")
    return result.stdout


def restore_test(backup, env, fingerprints, root):
    name = "battleship-restore-test-" + secrets.token_hex(4)
    docker("run", "-d", "--rm", "--name", name, "--network", "none", "--memory", "512m", "--tmpfs", "/var/lib/postgresql/data",
           "-e", "POSTGRES_DB=battleship", "-e", "POSTGRES_USER=battleship", "-e", "POSTGRES_PASSWORD=" + secrets.token_urlsafe(24),
           env["DATABASE_IMAGE"])
    try:
        for _ in range(60):
            if subprocess.run(["docker", "exec", name, "pg_isready", "-U", "battleship"], capture_output=True).returncode == 0:
                break
            time.sleep(2)
        else:
            raise RuntimeError("restore-test database did not start")
        with open(Path(backup) / "battleship.dump", "rb") as stream:
            docker("exec", "-i", name, "pg_restore", "-U", "battleship", "-d", "postgres", "--clean", "--if-exists",
                   "--create", "--exit-on-error", file_in=stream)
        sql = (root / "database-fingerprint.sql").read_text()
        out = docker("exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "battleship", "-d", "battleship", text_in=sql)
        actual = sorted((json.loads(line) for line in out.splitlines() if line.strip()), key=lambda item: item["table"])
        if actual != fingerprints:
            raise RuntimeError("Restored fingerprints differ from the backup")
        return sum(item["rows"] for item in actual)
    finally:
        subprocess.run(["docker", "stop", "-t", "5", name], capture_output=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/opt/battleship"))
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root
    os.umask(0o077)
    if platform.machine() != "aarch64":
        sys.exit("Production host must be aarch64")
    env = parse_env((root / ".env").read_text())
    problems = check_env(env)
    if problems:
        sys.exit("Environment contract failed: " + "; ".join(problems))
    receipt_raw = args.receipt.read_bytes()
    receipt = json.loads(receipt_raw)
    if receipt.get("status") != "DATA_READY":
        sys.exit("Receipt is not DATA_READY")
    for key, container in CONTAINERS.items():
        details = json.loads(docker("inspect", container))[0]
        if not details["State"]["Running"] or details["Config"]["Image"] != env[key]:
            sys.exit(container + " is not running the .env image")
        if receipt["containers"][container]["image_ref"] != env[key]:
            sys.exit(container + " differs from the cut receipt")
        if key == "DATABASE_IMAGE":
            if not any(m.get("Name") == VOLUME for m in details["Mounts"]):
                sys.exit("Database does not use the authority volume")
            if details["State"].get("Health", {}).get("Status") != "healthy":
                sys.exit("Database is not healthy")
    print("PASS environment, containers, images and authority volume match", flush=True)
    stamp = datetime.datetime.now(datetime.timezone.utc)
    backup = root / "backups" / ("activation-" + stamp.strftime("%Y%m%dT%H%M%SZ"))
    docker_out = subprocess.run([sys.executable, str(root / "consistent-backup.py"), str(backup)], capture_output=True, text=True)
    if docker_out.returncode:
        sys.exit("Fresh backup failed")
    fingerprints = verify_backup(backup)
    print("PASS fresh consistent backup verified:", backup.name, flush=True)
    rows = restore_test(backup, env, fingerprints, root)
    print("PASS restore into a throwaway database has identical fingerprints (%d rows)" % rows, flush=True)
    owner = root.stat()
    if os.geteuid() == 0:
        for path in [backup, *backup.iterdir()]:
            os.chown(path, owner.st_uid, owner.st_gid)
    if not args.apply:
        print("CONTRACT_VALID (marker not written; rerun with --apply)")
        return
    marker = build_marker(env, hashlib.sha256(receipt_raw).hexdigest(),
                          {"path": str(backup), "dump_sha256": hashlib.sha256((backup / "battleship.dump").read_bytes()).hexdigest()},
                          rows, stamp.isoformat())
    temporary = root / ".production-active.tmp"
    temporary.write_text(json.dumps(marker, indent=2) + "\n")
    os.replace(temporary, root / ".production-active")
    if os.geteuid() == 0:
        os.chown(root / ".production-active", owner.st_uid, owner.st_gid)
    print("ACTIVATED .production-active written for the exact contract")


if __name__ == "__main__":
    main()
