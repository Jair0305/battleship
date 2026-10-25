#!/usr/bin/env python3
"""Verify actual JRE trust, including CVE-2026-91403 which image scans can miss."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--compiler-image", help="Private verification JDK image, when the host has no JDK")
    args = parser.parse_args()
    with urllib.request.urlopen("https://emudhra.we-have-a-problem.com/chains.zip", timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != "7b949956955fc501a30f4d98d2f513d34c0bbbe92e29a968194c96e097ce2345":
        raise RuntimeError("Published certificate fixture changed; review before using it")
    with urllib.request.urlopen("https://emudhra.we-have-a-problem.com/roots.json", timeout=60) as response:
        roots_data = response.read()
    if hashlib.sha256(roots_data).hexdigest() != "119f32cd81a6b5a4e3c4c2df5fe07daa90dc43cafa123a62f0394f1895d92380":
        raise RuntimeError("Published fixture roots changed; review before using them")
    directory = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="battleship-java-trust-") as temporary:
        root = Path(temporary)
        root.chmod(0o755)
        (root / "chains").mkdir(mode=0o755)
        (root / "roots").mkdir(mode=0o755)
        for index, certificate in enumerate(json.loads(roots_data)):
            path = root / "roots" / (str(index) + ".pem")
            path.write_text(certificate["pem"])
            path.chmod(0o644)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for member in archive.infolist():
                path = PurePosixPath(member.filename)
                if path.parent != PurePosixPath("chains") or path.suffix != ".pem":
                    continue
                destination = root / "chains" / path.name
                destination.write_bytes(archive.read(member))
                destination.chmod(0o644)
        fingerprints = directory.parents[1] / "battleship-backend/docker/blocked-cert-fingerprints.txt"
        shutil.copyfile(fingerprints, root / "fingerprints.txt")
        (root / "fingerprints.txt").chmod(0o644)
        if args.compiler_image:
            subprocess.run(["docker", "run", "--rm", "--network", "none", "--memory", "256m", "--cpus", "0.5",
                            "--mount", "type=bind,source=" + str(root) + ",target=/verification",
                            "--mount", "type=bind,source=" + str(directory / "CheckJavaTrust.java") + ",target=/CheckJavaTrust.java,readonly",
                            "--entrypoint", "/opt/java/jdk/bin/javac", args.compiler_image,
                            "--release", "21", "-d", "/verification", "/CheckJavaTrust.java"], check=True)
        else:
            subprocess.run(["javac", "--release", "21", "-d", str(root), str(directory / "CheckJavaTrust.java")], check=True)
        for compiled in root.glob("*.class"):
            compiled.chmod(0o644)
        command = ["docker", "run", "--rm", "--memory", "128m", "--cpus", "0.5",
                   "--mount", "type=bind,source=" + str(root) + ",target=/verification,readonly",
                   "--entrypoint", "java"]
        # Fixture roots are trusted ONLY in the verification JVM, never the app's
        # trust store. Removing sixteen blocks in an isolated disposable container
        # provides a positive control even when upstream already removed roots.
        baseline_command = command[:-2] + ["--user", "0", "--network", "none", "--entrypoint", "sh", args.image,
            "-ec", "grep -vFx -f /verification/fingerprints.txt \"$JAVA_HOME/lib/security/blocked.certs\" > /tmp/untreated.certs; "
            "cat /tmp/untreated.certs > \"$JAVA_HOME/lib/security/blocked.certs\"; "
            "exec java -cp /verification CheckJavaTrust /verification/chains /verification/fingerprints.txt --baseline /verification/roots"]
        untreated = subprocess.check_output(baseline_command, text=True)
        accepted = [line.removeprefix("ACCEPTED ") for line in untreated.splitlines() if line.startswith("ACCEPTED ")]
        if not accepted:
            raise RuntimeError("Untreated control accepted no chains; review fixture/runtime applicability")
        control = root / "baseline-accepted.txt"
        control.write_text("\n".join(accepted) + "\n")
        control.chmod(0o644)
        print("Untreated JRE accepts " + str(len(accepted)) + " published chains", flush=True)
        subprocess.run(command + ["--network", "none", args.image, "-cp", "/verification", "CheckJavaTrust",
                                  "/verification/chains", "/verification/fingerprints.txt",
                                  "/verification/baseline-accepted.txt", "/verification/roots"], check=True)
        # Independently check the actual unmodified default trust manager.
        (root / "no-fixture-control.txt").write_text("")
        (root / "no-fixture-control.txt").chmod(0o644)
        subprocess.run(command + ["--network", "none", args.image, "-cp", "/verification", "CheckJavaTrust",
                                  "/verification/chains", "/verification/fingerprints.txt",
                                  "/verification/no-fixture-control.txt"], check=True)
        subprocess.run(command + [args.image, "-cp", "/verification", "CheckJavaTrust", "--https-control"], check=True)


if __name__ == "__main__":
    main()
