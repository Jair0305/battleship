"""Exercise deployment races and bootstrap with an isolated fake Docker daemon."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


@unittest.skipUnless(os.name == "posix", "Linux deployment script")
class DeployGuardsTests(unittest.TestCase):
    def exercise(self, activity, invalid_config=False):
        temporary = tempfile.TemporaryDirectory(prefix="battleship-deploy-test-")
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        revision = "a" * 40
        candidate = root / "incoming" / revision
        candidate.mkdir(parents=True)
        (root / ".production-active").write_text(json.dumps({
            "contract_version": 1, "status": "active",
            "authority": {"host": "phosrvr", "volume": "battleship_postgres_data"}}))
        original = "BATTLESHIP_POSTGRES_VOLUME=battleship_postgres_data\nBACKEND_IMAGE=old-backend\nFRONTEND_IMAGE=old-frontend\n"
        (root / ".env").write_text(original)
        for name in ["docker-compose.phosrvr.yml", "nginx.conf"]:
            (root / name).write_text("original\n")
            (candidate / name).write_text("candidate\n")
        (candidate / "database-fingerprint.sql").write_text("-- fixture\n")
        (candidate / "consistent-backup.py").write_text(
            "from pathlib import Path\nimport sys\nPath(sys.argv[1]).mkdir(parents=True)\n")
        state = root / "state.json"
        state.write_text(json.dumps({"activity": activity, "events": []}))
        binary = root / "bin"
        binary.mkdir()
        docker = binary / "docker"
        docker.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p=Path(os.environ['TEST_STATE']); s=json.loads(p.read_text()); args=sys.argv[1:]
s['events'].append(args)
if args[:2]==['login','ghcr.io']: sys.stdin.read()
elif args[:2]==['image','inspect']: print('arm64')
elif args[:2]==['exec','battleship-db']:
    print(s['activity'].pop(0))
elif args[0]=='compose' and args[-2:]==['config','-q']:
    values=dict(line.split('=',1) for line in Path('.env').read_text().splitlines())
    values.update(os.environ)
    keys=['BACKEND_IMAGE','FRONTEND_IMAGE','DATABASE_IMAGE','PROXY_IMAGE']
    if os.environ.get('TEST_INVALID_CONFIG')=='1' or not all(values.get(k) for k in keys):
        p.write_text(json.dumps(s)); sys.exit(1)
p.write_text(json.dumps(s))
''')
        docker.chmod(0o755)
        for name, body in [("uname", "echo aarch64"), ("curl", "exit 0")]:
            path = binary / name
            path.write_text("#!/bin/sh\n" + body + "\n")
            path.chmod(0o755)
        source = Path(__file__).resolve().parents[1] / "migration" / "deploy-phosrvr.sh"
        script = root / "deploy.sh"
        script.write_text(source.read_text().replace("/opt/battleship", str(root)))
        environment = os.environ.copy()
        for key in ["BACKEND_IMAGE", "FRONTEND_IMAGE", "DATABASE_IMAGE", "PROXY_IMAGE"]:
            environment.pop(key, None)
        environment.update(PATH=str(binary) + os.pathsep + environment["PATH"],
                           TEST_STATE=str(state), TEST_INVALID_CONFIG="1" if invalid_config else "0")
        result = subprocess.run(["bash", str(script), revision, "fixture-actor"],
                                cwd=root, env=environment, input="test-only-token",
                                text=True, capture_output=True, timeout=15)
        return root, original, result, json.loads(state.read_text())["events"]

    def test_inflight_commit_after_shutdown_defers_without_config_or_data_change(self):
        root, original, result, events = self.exercise([0, 0, 1])
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("deployment deferred", result.stdout)
        self.assertEqual((root / ".env").read_text(), original)
        self.assertEqual((root / "docker-compose.phosrvr.yml").read_text(), "original\n")
        self.assertFalse((root / "backups").exists())
        stopped = events.index(["stop", "--time", "60", "battleship-backend"])
        checks = [i for i, args in enumerate(events) if args[:2] == ["exec", "battleship-db"]]
        self.assertGreater(checks[-1], stopped)
        self.assertIn(["start", "battleship-backend"], events)
        self.assertIn(["start", "battleship-nginx"], events)

    def test_two_reference_environment_can_adopt_four_tested_images(self):
        root, original, result, events = self.exercise([0, 0, 0])
        self.assertEqual(result.returncode, 0, result.stderr)
        current = (root / ".env").read_text()
        self.assertIn("DATABASE_IMAGE=ghcr.io/jair0305/battleship-postgres:", current)
        self.assertIn("PROXY_IMAGE=ghcr.io/jair0305/battleship-nginx:", current)
        backups = list((root / "backups").glob("*/environment.private"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), original)
        self.assertEqual(len([args for args in events if args[0] == "pull"]), 4)

    def test_invalid_candidate_never_pauses_ingress(self):
        root, original, result, events = self.exercise([0], invalid_config=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(args[0] == "stop" for args in events))
        self.assertEqual((root / ".env").read_text(), original)


if __name__ == "__main__":
    unittest.main()
