#!/usr/bin/env python3
"""Battleship-only off-host backup. Linux root; Python standard library.

Reuses the existing recovery receiver profile (repository, CA and credentials of
nightly-recovery) without touching that service: its own host/tag, no forget or
prune, no retries. Uploads the latest VERIFIED daily logical backup plus the
configuration needed to rebuild, then reads the snapshot back, restores it
selectively into an isolated directory and proves the restored dump against its
fingerprints in a throwaway database. Prints fixed reason codes only."""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

REPOSITORY = "rest:https://100.106.195.121:8322/vm4/observability/"
CA = Path("/etc/nightly-recovery/receiver.crt")
SECRET_ROOT = Path("/etc/nightly-recovery")
RESTIC = Path("/usr/local/lib/nightly-recovery/bin/restic-0.19.1")
APP = Path("/opt/battleship")
STATE_ROOT = Path("/var/lib/battleship-offhost")
CACHE = Path("/var/cache/battleship-offhost")
HOST = "vm4-battleship"
TAG = "battleship-critical-v1"
DAILY = re.compile(r"daily-\d{8}T\d{6}Z")
HEX = re.compile(r"[0-9a-f]{8,64}")
ARTIFACTS = ("battleship.dump", "fingerprint.json", "globals.private.sql", "SHA256SUMS", "environment.private")
CONFIG_FILES = (".production-active", "backups/last-daily.public.json", "database-fingerprint.sql", "consistent-backup.py")


class BackupError(Exception):
    """Fixed reason codes only; never expose subprocess output."""


def load_helpers():
    spec = importlib.util.spec_from_file_location("activate_production", Path(__file__).with_name("activate-production.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def child_environment(root):
    password = root / "repository-password"
    transport = (root / "transport-password").read_text().strip()
    return {"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "HOME": str(STATE_ROOT),
            "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "GOMAXPROCS": "1", "GOMEMLIMIT": "256MiB",
            "RESTIC_PASSWORD_FILE": str(password), "RESTIC_REST_USERNAME": "vm4", "RESTIC_REST_PASSWORD": transport}


def capture(command, env, code, timeout=600):
    try:
        result = subprocess.run(command, env=env, capture_output=True, timeout=timeout, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise BackupError("unknown_state")
    if result.returncode:
        raise BackupError(code)
    return result.stdout


def source_checks(helpers):
    """Latest verified daily backup only; its checksums are re-hashed here."""
    marker = APP / ".production-active"
    if not helpers.valid_marker(marker.read_text()):
        raise BackupError("marker_invalid")
    recorded = json.loads((APP / "backups" / "last-daily.public.json").read_text())
    if recorded.get("status") != "verified" or not DAILY.fullmatch(recorded.get("backup", "")):
        raise BackupError("source_unverified")
    directory = APP / "backups" / recorded["backup"]
    fingerprints = helpers.verify_backup(directory)
    if hashlib.sha256((directory / "battleship.dump").read_bytes()).hexdigest() != recorded["dump_sha256"]:
        raise BackupError("source_unverified")
    return recorded, directory, fingerprints


def confirm_snapshot(raw, snapshot):
    items = json.loads(raw)
    if (len(items) != 1 or not items[0]["id"].startswith(snapshot[:8]) or items[0]["hostname"] != HOST
            or TAG not in items[0].get("tags", [])):
        raise BackupError("confirmation_failed")
    return items[0]["id"]


def main():
    if os.geteuid() != 0 or sys.platform != "linux":
        sys.exit("Linux root only")
    os.umask(0o077)
    STATE_ROOT.mkdir(mode=0o700, exist_ok=True)
    CACHE.mkdir(mode=0o700, exist_ok=True)
    state = {"status": "failed", "attempt_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "error_code": ""}
    lock = open(STATE_ROOT / "lock", "w")
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise BackupError("locked")
        helpers = load_helpers()
        recorded, directory, fingerprints = source_checks(helpers)
        credentials = os.environ.get("CREDENTIALS_DIRECTORY")
        env = child_environment(Path(credentials) if credentials else SECRET_ROOT)
        base = [str(RESTIC), "--repo", REPOSITORY, "--cacert", str(CA), "--cache-dir", str(CACHE)]
        paths = [str(directory)] + [str(APP / name) for name in CONFIG_FILES]
        raw = capture(base + ["backup", "--json", "--quiet", "--host", HOST, "--tag", TAG, "--tag", "source-" + recorded["backup"],
                              "--limit-upload=2048"] + paths, env, "backup_failed")
        summaries = [json.loads(line) for line in raw.decode().splitlines() if line.startswith("{")]
        snapshot = [item for item in summaries if item.get("message_type") == "summary"][-1]["snapshot_id"]
        if not HEX.fullmatch(snapshot):
            raise BackupError("confirmation_failed")
        snapshot = confirm_snapshot(capture(base + ["snapshots", "--json", "--host", HOST, "--tag", TAG, snapshot], env, "confirmation_failed"), snapshot)
        listing = capture(base + ["ls", snapshot], env, "readback_failed").decode().splitlines()
        stored = {line.rsplit("/", 1)[-1] for line in listing}
        if not set(ARTIFACTS) <= stored:
            raise BackupError("readback_failed")
        target = STATE_ROOT / "restore-test" / snapshot[:12]
        if target.exists():
            raise BackupError("restore_failed")
        target.mkdir(parents=True, mode=0o700)
        try:
            includes = []
            for name in ARTIFACTS:
                includes += ["--include", str(directory / name)]
            for name in CONFIG_FILES:
                includes += ["--include", str(APP / name)]
            capture(base + ["restore", snapshot, "--target", str(target)] + includes, env, "restore_failed")
            restored = target / str(directory).lstrip("/")
            if helpers.verify_backup(restored) != fingerprints:
                raise BackupError("restore_failed")
            config = helpers.parse_env((restored / "environment.private").read_text())
            if helpers.check_env(config):
                raise BackupError("restore_failed")
            rows = helpers.restore_test(restored, config, fingerprints, target / "opt" / "battleship")
        finally:
            shutil.rmtree(target, ignore_errors=True)
        state.update(status="verified", error_code="", snapshot=snapshot, source=recorded["backup"], tables=len(fingerprints),
                     rows=rows, dump_sha256=recorded["dump_sha256"], restore_fingerprints="identical",
                     completed_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), custody="off-host-restic-receiver")
    except BackupError as error:
        state["error_code"] = str(error)
    except Exception:
        state["error_code"] = "backup_runner_failed"
    finally:
        public = dict(state)
        temporary = STATE_ROOT / "last-offhost.tmp"
        temporary.write_text(json.dumps(public, indent=2) + "\n")
        os.replace(temporary, STATE_ROOT / "last-offhost.json")
        if state["status"] == "verified":
            mirror = APP / "backups" / "last-offhost.public.json"
            shutil.copyfile(STATE_ROOT / "last-offhost.json", mirror)
            os.chmod(mirror, 0o644)
        print(json.dumps({"event": "battleship_offhost", "status": state["status"], "error_code": state["error_code"]}, sort_keys=True))
    sys.exit(0 if state["status"] == "verified" else 1)


if __name__ == "__main__":
    main()
