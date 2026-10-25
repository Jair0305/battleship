"""Exercise the off-host backup's fixed-code safety checks without a receiver."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock

MIGRATION = Path(__file__).resolve().parents[1] / "migration"
spec = importlib.util.spec_from_file_location("offhost_backup", MIGRATION / "offhost-backup.py")
offhost = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offhost)

SNAPSHOT = "a" * 64


class OffhostBackupTests(unittest.TestCase):
    def snapshot(self, **changes):
        item = {"id": SNAPSHOT, "hostname": offhost.HOST, "tags": [offhost.TAG, "source-daily-x"]}
        item.update(changes)
        return json.dumps([item])

    def test_snapshot_confirmation_requires_exactly_the_battleship_snapshot(self):
        self.assertEqual(offhost.confirm_snapshot(self.snapshot(), SNAPSHOT), SNAPSHOT)
        for raw in (self.snapshot(hostname="vm4-observability"), self.snapshot(tags=["critical-state-v1"]),
                    self.snapshot(id="b" * 64), "[]"):
            with self.assertRaises(offhost.BackupError):
                offhost.confirm_snapshot(raw, SNAPSHOT)

    def test_unknown_outcomes_are_never_retried_and_use_fixed_codes(self):
        timeout = subprocess.TimeoutExpired("restic", 1)
        with mock.patch.object(offhost.subprocess, "run", side_effect=timeout) as run:
            with self.assertRaisesRegex(offhost.BackupError, "unknown_state"):
                offhost.capture(["restic"], {}, "backup_failed")
            self.assertEqual(run.call_count, 1)
        failed = subprocess.CompletedProcess(["restic"], 1, b"", b"secret-looking output")
        with mock.patch.object(offhost.subprocess, "run", return_value=failed):
            with self.assertRaises(offhost.BackupError) as raised:
                offhost.capture(["restic"], {}, "backup_failed")
            self.assertEqual(str(raised.exception), "backup_failed")

    def test_scope_is_battleship_only_and_never_prunes(self):
        text = (MIGRATION / "offhost-backup.py").read_text()
        self.assertNotIn('"forget"', text)
        self.assertNotIn('"prune"', text)
        self.assertEqual((offhost.HOST, offhost.TAG), ("vm4-battleship", "battleship-critical-v1"))


if __name__ == "__main__":
    unittest.main()
