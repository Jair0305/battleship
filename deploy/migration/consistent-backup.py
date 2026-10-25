#!/usr/bin/env python3
"""Create a logical, snapshot-consistent Battleship backup. Never print data/secrets."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--container", default="battleship-db")
    args = parser.parse_args()
    os.umask(0o077)
    args.destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    command = ["docker", "exec", "-i", args.container, "psql", "-X", "-qAt",
               "-v", "ON_ERROR_STOP=1", "-U", "battleship", "-d", "battleship"]
    with (args.destination / "psql-errors.private.log").open("w") as errors:
        session = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=errors, text=True, bufsize=1)
        def query(sql):
            marker = "END_" + uuid.uuid4().hex
            session.stdin.write(sql + "\n\\echo " + marker + "\n")
            session.stdin.flush()
            rows = []
            for line in session.stdout:
                if line.strip() == marker:
                    return rows
                if line.strip():
                    rows.append(line.strip())
            raise RuntimeError("Snapshot session failed; inspect private error log")
        try:
            query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;")
            snapshot = query("SELECT pg_export_snapshot();")[0]
            fingerprint_sql = Path(__file__).with_name("database-fingerprint.sql").read_text()
            fingerprints = [json.loads(row) for row in query(fingerprint_sql)]
            with (args.destination / "battleship.dump").open("wb") as output:
                subprocess.run(["docker", "exec", args.container, "pg_dump", "-U", "battleship",
                                "-d", "battleship", "--format=custom", "--create",
                                "--snapshot=" + snapshot], stdout=output, stderr=errors, check=True)
            (args.destination / "fingerprint.json").write_text(json.dumps(fingerprints, indent=2) + "\n")
            query("COMMIT;")
            session.stdin.close()
            if session.wait(timeout=30) != 0:
                raise RuntimeError("Snapshot session did not finish cleanly")
        finally:
            if session.poll() is None:
                session.terminate()
                session.wait(timeout=30)
        with (args.destination / "globals.private.sql").open("wb") as output:
            subprocess.run(["docker", "exec", args.container, "pg_dumpall", "-U", "battleship",
                            "--globals-only"], stdout=output, stderr=errors, check=True)
    artifacts = ["battleship.dump", "fingerprint.json", "globals.private.sql"]
    (args.destination / "SHA256SUMS").write_text("".join(
        hashlib.sha256((args.destination / name).read_bytes()).hexdigest() + "  " + name + "\n"
        for name in artifacts))
    print(json.dumps({"backup": str(args.destination), "tables": len(fingerprints),
                      "rows": sum(x["rows"] for x in fingerprints), "status": "complete"}))


if __name__ == "__main__":
    main()
