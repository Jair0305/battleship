import os
from pathlib import Path
import subprocess
import tempfile
import unittest


@unittest.skipUnless(os.name == "posix", "Linux JDK patch script")
class JavaTrustPolicyTests(unittest.TestCase):
    def test_blocklist_is_complete_idempotent_and_preserves_prior_entries(self):
        script = Path(__file__).resolve().parents[2] / "battleship-backend/docker/patch-java-trust.sh"
        with tempfile.TemporaryDirectory() as temporary:
            java = Path(temporary)
            security = java / "lib/security"
            security.mkdir(parents=True)
            blocked = security / "blocked.certs"
            previous = "Algorithm=SHA-256\n" + "A" * 64 + "\n"
            blocked.write_text(previous)
            subprocess.run(["sh", str(script), str(java)], check=True, capture_output=True)
            first = blocked.read_bytes()
            subprocess.run(["sh", str(script), str(java)], check=True, capture_output=True)
            self.assertEqual(first, blocked.read_bytes())
            self.assertTrue(first.decode().startswith(previous))
            self.assertEqual(len([line for line in first.decode().splitlines() if len(line) == 64]), 17)

    def test_unexpected_hash_algorithm_fails_closed(self):
        script = Path(__file__).resolve().parents[2] / "battleship-backend/docker/patch-java-trust.sh"
        with tempfile.TemporaryDirectory() as temporary:
            java = Path(temporary)
            security = java / "lib/security"
            security.mkdir(parents=True)
            blocked = security / "blocked.certs"
            blocked.write_text("Algorithm=SHA-1\n")
            result = subprocess.run(["sh", str(script), str(java)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(blocked.read_text(), "Algorithm=SHA-1\n")


if __name__ == "__main__":
    unittest.main()
