#!/usr/bin/env python3
"""CP058 — replay a PUBLIC Crownicles WA LAB commit without GitHub Actions.

No token, no private endpoints, no writes to the source repo. A checkout is
materialized only after every archive file matches GitHub's commit tree Git
blob SHA. By default NO source code is executed. Flags opt in to tests.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import zipfile

OWNER = "Otiosun"
REPO = "Crownicles-wa-lab"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
ARCHIVE = f"https://codeload.github.com/{OWNER}/{REPO}/zip"
SHA = re.compile(r"^[0-9a-f]{40}$")
PR_NUMBER = re.compile(r"^[1-9][0-9]{0,6}$")
MAX_ARCHIVE = 120 * 1024 * 1024
MAX_UNPACKED = 160 * 1024 * 1024
MAX_FILE = 40 * 1024 * 1024
MAX_ENTRIES = 10000
USER_AGENT = "Crownicles-CP058-Public-Checkout/1.0"


class CheckoutError(RuntimeError):
    pass


def ensure_sha(value: str) -> str:
    if not SHA.fullmatch(value):
        raise CheckoutError("CP058_INVALID_40_HEX_COMMIT")
    return value


def fetch(url: str, limit: int = 5 * 1024 * 1024) -> bytes:
    if not (url.startswith(API + "/") or url.startswith(ARCHIVE + "/")):
        raise CheckoutError("CP058_NON_ALLOWLIST_URL")
    request = Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github+json" if url.startswith(API) else "application/zip",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urlopen(request, timeout=45) as stream:
            length = stream.headers.get("Content-Length")
            if length is not None and int(length) > limit:
                raise CheckoutError("CP058_DOWNLOAD_LIMIT")
            buf = stream.read(limit + 1)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise CheckoutError(f"CP058_NETWORK_UNAVAILABLE: {type(exc).__name__}") from exc
    if len(buf) > limit:
        raise CheckoutError("CP058_DOWNLOAD_LIMIT")
    return buf


def load_json(url: str) -> dict:
    try:
        result = json.loads(fetch(url))
    except (ValueError, UnicodeDecodeError) as exc:
        raise CheckoutError("CP058_GITHUB_RESPONSE_INVALID") from exc
    if not isinstance(result, dict):
        raise CheckoutError("CP058_GITHUB_RESPONSE_INVALID")
    return result


def resolve_commit(pr: int | None, sha: str | None) -> str:
    if (pr is None) == (sha is None):
        raise CheckoutError("CP058_SPECIFY_EXACTLY_ONE_PR_OR_SHA")
    if sha is not None:
        return ensure_sha(sha)
    if not (1 <= pr <= 9999999):
        raise CheckoutError("CP058_PR_INVALID")
    data = load_json(f"{API}/pulls/{pr}")
    if data.get("head", {}).get("repo", {}).get("full_name") != f"{OWNER}/{REPO}":
        raise CheckoutError("CP058_PR_NOT_FROM_EXPECTED_REPOSITORY")
    return ensure_sha(data.get("head", {}).get("sha", ""))


def source_tree(sha: str) -> dict[str, dict]:
    sha = ensure_sha(sha)
    commit = load_json(f"{API}/git/commits/{sha}")
    if commit.get("sha") != sha:
        raise CheckoutError("CP058_COMMIT_SHA_MISMATCH")
    root = ensure_sha(commit.get("tree", {}).get("sha", ""))
    tree = load_json(f"{API}/git/trees/{root}?recursive=1")
    if tree.get("sha") != root or tree.get("truncated") is not False:
        raise CheckoutError("CP058_TREE_MISMATCH_OR_TRUNCATED")
    entries = tree.get("tree")
    if not isinstance(entries, list) or len(entries) > MAX_ENTRIES:
        raise CheckoutError("CP058_TREE_INVALID")
    result = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise CheckoutError("CP058_TREE_INVALID")
        path = entry.get("path")
        typ = entry.get("type")
        mode = entry.get("mode")
        if typ == "tree":
            valid_path(path)
            continue
        if typ != "blob" or mode not in ("100644", "100755"):
            # Symlink mode 120000 and submodules mode 160000 are not executed.
            raise CheckoutError("CP058_NON_REGULAR_GIT_ENTRY")
        valid_path(path)
        if path in result:
            raise CheckoutError("CP058_DUPLICATE_GIT_PATH")
        blob_sha = ensure_sha(entry.get("sha", ""))
        size = entry.get("size")
        if not isinstance(size, int) or size < 0 or size > MAX_FILE:
            raise CheckoutError("CP058_TREE_FILE_SIZE_INVALID")
        result[path] = {"sha": blob_sha, "mode": mode, "size": size}
    if not result:
        raise CheckoutError("CP058_EMPTY_TREE")
    return result


def valid_path(path: str) -> None:
    if not isinstance(path, str) or not path or "\\" in path or "\x00" in path:
        raise CheckoutError("CP058_UNSAFE_PATH")
    pure = PurePosixPath(path)
    if path.startswith("/") or any(part in ("", ".", "..") for part in path.split("/")):
        raise CheckoutError("CP058_UNSAFE_PATH")
    if pure.is_absolute() or len(pure.parts) < 1 or ":" in pure.parts[0]:
        raise CheckoutError("CP058_UNSAFE_PATH")


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def verify_archive(archive: bytes, expected: dict[str, dict]) -> dict[str, bytes]:
    if len(archive) > MAX_ARCHIVE:
        raise CheckoutError("CP058_ARCHIVE_LIMIT")
    try:
        zipped = zipfile.ZipFile(io.BytesIO(archive))
    except (zipfile.BadZipFile, OSError) as exc:
        raise CheckoutError("CP058_ARCHIVE_INVALID") from exc
    files = {}
    total = 0
    prefix = None
    with zipped:
        entries = zipped.infolist()
        if len(entries) > MAX_ENTRIES:
            raise CheckoutError("CP058_ARCHIVE_ENTRIES_LIMIT")
        for info in entries:
            raw = info.filename
            if not raw or "\\" in raw or "\x00" in raw or raw.startswith("/"):
                raise CheckoutError("CP058_ARCHIVE_UNSAFE_PATH")
            # codeload zip contains one prefix directory, e.g. repo-<sha>.
            parts = raw.rstrip("/").split("/")
            if not parts or not parts[0].startswith(REPO + "-"):
                raise CheckoutError("CP058_ARCHIVE_ROOT_UNEXPECTED")
            if prefix is None:
                prefix = parts[0]
            if parts[0] != prefix:
                raise CheckoutError("CP058_ARCHIVE_MULTIPLE_ROOTS")
            if len(parts) < 2:
                if not info.is_dir():
                    raise CheckoutError("CP058_ARCHIVE_ROOT_FILE")
                continue
            rel = "/".join(parts[1:])
            valid_path(rel)
            mode = (info.external_attr >> 16) & 0o170000
            if mode not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise CheckoutError("CP058_ARCHIVE_SYMLINK_OR_SPECIAL")
            if info.is_dir():
                continue
            if info.file_size > MAX_FILE:
                raise CheckoutError("CP058_ARCHIVE_FILE_LIMIT")
            total += info.file_size
            if total > MAX_UNPACKED:
                raise CheckoutError("CP058_UNPACKED_LIMIT")
            if rel in files:
                raise CheckoutError("CP058_ARCHIVE_DUPLICATE_FILE")
            if rel not in expected:
                raise CheckoutError("CP058_ARCHIVE_EXTRA_FILE:" + rel)
            try:
                data = zipped.read(info)
            except (zipfile.BadZipFile, RuntimeError) as exc:
                raise CheckoutError("CP058_ARCHIVE_CRC_FAILURE") from exc
            if len(data) != expected[rel]["size"] or git_blob_sha(data) != expected[rel]["sha"]:
                raise CheckoutError("CP058_BLOB_SHA_MISMATCH:" + rel)
            files[rel] = data
    missing = set(expected) - set(files)
    if missing:
        raise CheckoutError("CP058_ARCHIVE_MISSING_BLOBS:" + str(len(missing)))
    return files


def materialize(files: dict[str, bytes], destination: Path) -> None:
    dest = destination.absolute()
    if dest.exists() or dest.is_symlink():
        raise CheckoutError("CP058_DESTINATION_EXISTS")
    parent = dest.parent
    if not parent.is_dir() or parent.is_symlink():
        raise CheckoutError("CP058_OUTPUT_PARENT_INVALID")
    # No extraction side effects until every byte has been verified.
    tmp = Path(tempfile.mkdtemp(prefix=".cp058-", dir=parent))
    try:
        for name, content in files.items():
            target = tmp.joinpath(*name.split("/"))
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(content)
        os.rename(tmp, dest)
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


def clean_test_env(cwd: Path) -> dict[str, str]:
    """Never pass local credentials/accounts into downloaded test processes."""
    sensitive = re.compile(r"TOKEN|PASSWORD|PASSWD|SECRET|CREDENTIAL|PRIVATE_KEY|"
                           r"API_KEY|ACCESS_KEY|AUTH|COOKIE|BAILEYS|WHATSAPP|DATABASE|MARIADB|MYSQL|MQTT|DB_|SESSION", re.I)
    env = {k: v for k, v in os.environ.items() if not sensitive.search(k) and
           k.upper() not in ("NODE_OPTIONS", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY")}
    isolated_home = cwd / ".cp058-empty-home"
    isolated_home.mkdir(exist_ok=True)
    env["HOME"] = str(isolated_home)
    env["USERPROFILE"] = str(isolated_home)
    env["NODE_ENV"] = "test"
    env["CROWNICLES_OFFLINE_LAB"] = "1"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def run_checked(command: list[str], cwd: Path, timeout: int, logfile: Path) -> dict:
    started = time.time()
    binary = command[0]
    resolved = shutil.which(binary)
    if not resolved:
        raise CheckoutError("CP058_REQUIRED_EXECUTABLE_MISSING:" + binary)
    args = [resolved] + command[1:]
    with logfile.open("wb") as stream:
        try:
            p = subprocess.run(args, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT,
                               timeout=timeout, check=False, env=clean_test_env(cwd))
        except subprocess.TimeoutExpired:
            raise CheckoutError("CP058_TEST_TIMEOUT:" + command[1])
    return {"command": command, "exit": p.returncode,
            "seconds": round(time.time() - started, 2), "log": str(logfile)}


def run_syntax(dest: Path, paths: list[str], logfile: Path) -> dict:
    node = shutil.which("node")
    if not node:
        raise CheckoutError("CP058_REQUIRED_EXECUTABLE_MISSING:node")
    cases = sorted(p for p in paths if p.endswith((".cjs", ".mjs", ".js")))
    if not cases:
        raise CheckoutError("CP058_NO_JS_SOURCES")
    start = time.time()
    count = 0
    with logfile.open("wb") as out:
        for name in cases:
            out.write(("CHECK " + name + "\n").encode())
            try:
                child = subprocess.run([node, "--check", name], cwd=dest, stdout=out,
                                       stderr=subprocess.STDOUT, timeout=30,
                                       env=clean_test_env(dest))
            except subprocess.TimeoutExpired:
                raise CheckoutError("CP058_JS_SYNTAX_TIMEOUT:" + name)
            if child.returncode:
                raise CheckoutError("CP058_JS_SYNTAX_FAILED:" + name)
            count += 1
    return {"command": "node --check for each JS/CJS/MJS source", "exit": 0,
            "files_checked": count, "seconds": round(time.time()-start,2),
            "log": str(logfile), "TS": "NOT_COMPILED"}


def run_unit_tests(dest: Path, paths: list[str], logfile: Path, timeout: int) -> dict:
    # Fixed, public code-test paths, not arbitrary shell commands or runtime start.
    tests = sorted(p for p in paths if p.endswith(".test.cjs") and
                   (p.startswith("integral-native-router/beta/") or
                    p.startswith("integral-native-router/test/")))
    if not tests:
        raise CheckoutError("CP058_NO_ALLOWED_TESTS")
    result = run_checked(["node", "--test", *tests], dest, timeout, logfile)
    result["test_files"] = len(tests)
    return result


def execute(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--pr", type=int, help="Use public PR current HEAD; record pinned SHA in evidence")
    source.add_argument("--sha", help="Use exact immutable 40-hex commit SHA")
    parser.add_argument("--output", type=Path, default=None, help="New empty destination (must not exist)")
    parser.add_argument("--run-check", action="store_true", help="Opt in to node --check for each JS file (no bot startup)")
    parser.add_argument("--run-tests", action="store_true", help="Opt in to local node --test of public Core test files")
    parser.add_argument("--timeout", type=int, default=900, help="Max seconds for the optional public Core node:test suite")
    args = parser.parse_args(argv)
    if args.timeout < 60 or args.timeout > 1800:
        raise CheckoutError("CP058_TIMEOUT_OUT_OF_RANGE")
    sha = resolve_commit(args.pr, args.sha)
    dest = (args.output or Path.cwd() / f"crownicles-wa-lab-{sha[:12]}").absolute()
    if dest.exists() or dest.is_symlink():
        raise CheckoutError("CP058_DESTINATION_EXISTS")
    expected = source_tree(sha)
    archive = fetch(f"{ARCHIVE}/{sha}", MAX_ARCHIVE)
    verified = verify_archive(archive, expected)
    materialize(verified, dest)
    report = {"repo": f"{OWNER}/{REPO}", "commit": sha, "git_files": len(verified),
              "tree_all_verified": True, "source_execution_opt_in": bool(args.run_check or args.run_tests),
              "environment": {"python": sys.version.split()[0], "platform": sys.platform},
              "commands": [], "CI": "NOT_USED", "Core_native": "NOT_TESTED", "MariaDB": "NOT_TESTED",
              "WA_real": "NOT_TESTED", "MQTT_broker": "NOT_TESTED"}
    evidence = dest / "CP058-LOCAL-EVIDENCE.json"
    try:
        if args.run_check:
            result = run_syntax(dest, list(verified), dest / "CP058-SYNTAX.log")
            report["commands"].append(result)
        if args.run_tests:
            result = run_unit_tests(dest, list(verified), dest / "CP058-TESTS.log", args.timeout)
            report["commands"].append(result)
            if result["exit"] != 0:
                raise CheckoutError("CP058_TEST_PROCESS_FAILED:node:test")
    except CheckoutError as exc:
        report["state"] = "FAIL"
        report["error"] = str(exc)
        evidence.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise
    report["state"] = "PASS" if report["commands"] else "SOURCE_VERIFIED_ONLY"
    evidence.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"CP058_SOURCE_VERIFIED={len(verified)}/{len(expected)}; COMMIT={sha}; DIRECTORY={dest}")
    if report["commands"]:
        print("CP058_RUN_RESULTS=" + json.dumps(report["commands"]))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(execute())
    except CheckoutError as error:
        print("CP058_FAIL=" + str(error), file=sys.stderr)
        raise SystemExit(1)
