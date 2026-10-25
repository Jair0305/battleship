"""Exercise the production activation contract, marker gate and daily backup result."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

MIGRATION = Path(__file__).resolve().parents[1] / "migration"
spec = importlib.util.spec_from_file_location("activate_production", MIGRATION / "activate-production.py")
activate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activate)

DIGEST = "@sha256:" + "a" * 64
GOOD_ENV = "\n".join([
    "POSTGRES_PASSWORD=fixture", "BATTLESHIP_POSTGRES_VOLUME=battleship_postgres_data",
    "BACKEND_IMAGE=ghcr.io/jair0305/battleship-backend" + DIGEST,
    "FRONTEND_IMAGE=ghcr.io/jair0305/battleship-frontend:" + "b" * 40 + "-arm64",
    "DATABASE_IMAGE=ghcr.io/jair0305/battleship-postgres" + DIGEST,
    "PROXY_IMAGE=ghcr.io/jair0305/battleship-nginx" + DIGEST])


def write_backup(directory, tamper=False):
    directory.mkdir(parents=True)
    files = {"battleship.dump": b"dump", "globals.private.sql": b"globals",
             "fingerprint.json": json.dumps([{"table": "public.usuario", "rows": 2, "content_md5": "x"}]).encode()}
    for name, data in files.items():
        (directory / name).write_bytes(data)
    (directory / "SHA256SUMS").write_text("".join(
        hashlib.sha256(data).hexdigest() + "  " + name + "\n" for name, data in files.items()))
    if tamper:
        (directory / "battleship.dump").write_bytes(b"changed")


class ActivationContractTests(unittest.TestCase):
    def test_environment_contract_accepts_exact_arm64_references_only(self):
        self.assertEqual(activate.check_env(activate.parse_env(GOOD_ENV)), [])
        bad = GOOD_ENV.replace("battleship_postgres_data", "other").replace("battleship-nginx" + DIGEST, "battleship-nginx:latest")
        problems = activate.check_env(activate.parse_env(bad))
        self.assertEqual(len(problems), 2)
        self.assertTrue(activate.check_env(activate.parse_env(GOOD_ENV.replace("POSTGRES_PASSWORD=fixture", ""))))

    def test_marker_requires_the_exact_authority_contract(self):
        marker = activate.build_marker(activate.parse_env(GOOD_ENV), "c" * 64, {"path": "x"}, 7, "now")
        self.assertTrue(activate.valid_marker(json.dumps(marker)))
        self.assertFalse(activate.valid_marker(""))
        self.assertFalse(activate.valid_marker(json.dumps({**marker, "authority": {"host": "nightly-int", "volume": "battleship_postgres_data"}})))
        self.assertEqual(marker["offhost_backup"], "not-configured")

    def test_backup_verification_rejects_tampering(self):
        with tempfile.TemporaryDirectory() as temporary:
            good = Path(temporary) / "good"
            write_backup(good)
            self.assertEqual(activate.verify_backup(good)[0]["table"], "public.usuario")
            bad = Path(temporary) / "bad"
            write_backup(bad, tamper=True)
            with self.assertRaises(ValueError):
                activate.verify_backup(bad)

    @unittest.skipUnless(os.name == "posix", "Linux backup script")
    def test_daily_backup_records_verified_local_only_result_and_skips_without_marker(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "consistent-backup.py").write_text(
                "import json, sys\nfrom pathlib import Path\n"
                "sys.path.insert(0, %r)\nimport test_activation_contract as t\n"
                "t.write_backup(Path(sys.argv[1]))\n" % str(Path(__file__).parent))
            (root / ".env").write_text(GOOD_ENV)
            for name in ("docker-compose.phosrvr.yml", "nginx.conf"):
                (root / name).write_text("fixture\n")
            environment = dict(os.environ, BATTLESHIP_ROOT=str(root))
            command = ["bash", str(MIGRATION / "daily-backup.sh")]
            self.assertEqual(subprocess.run(command, env=environment, timeout=30).returncode, 0)
            self.assertFalse((root / "backups").exists())
            (root / ".production-active").write_text("{}")
            result = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            recorded = json.loads((root / "backups" / "last-daily.public.json").read_text())
            self.assertEqual((recorded["status"], recorded["custody"], recorded["rows"]), ("verified", "local-only", 2))
            self.assertEqual(recorded["dump_sha256"], hashlib.sha256(b"dump").hexdigest())


if __name__ == "__main__":
    unittest.main()
