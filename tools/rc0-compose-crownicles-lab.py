#!/usr/bin/env python3
"""Crownicles RC0: source-pinned, disposable, offline-WA lab composition.

Public PR6 source is verified against its immutable Git tree on GitHub.
Missing bridge .cjs dependencies are resolved from a caller-chosen local beta
folder and SHA256-pinned in the output report. Nothing is written to either
source folder. No game/WhatsApp service is started. Tests are opt-in.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shutil
import stat
import subprocess
import sys
from urllib.request import Request, urlopen

REPOSITORY = 'Otiosun/Crownicles-wa-lab'
COMMIT = '73f4473aecb16447d6adc3ba20f61a2c675806d3'
TREE = 'b467f65fc88604dfeff8b2c983ce588eed5bb370'
EXPECTED_FILES = 187
TEST_FILE = 'integral-native-router/test/native-universal.test.cjs'
TEST_BLOB_BEFORE = 'b59811f88118a10b40e6dd9360655f1a0f10cb3b'
TEST_BLOB_AFTER = '3a6fe5fd730e89a975dd2881f5056fcc47cc3309'
OLD_TEST = "assert.deepEqual(Object.keys(U.NATIVE).sort(),['expeditionResolve','guildCreate','petCaress','ping']);"
NEW_TEST = "assert.deepEqual(Object.keys(U.NATIVE).sort(),['expeditionResolve','friendlyFight','guildCreate','guildDescription','guildElderRemove','guildKick','guildLeave','petCaress','petFree','petTransfer','ping','unlock']);"
REQUIRE_RE = re.compile(r'''\brequire\s*\(\s*(['"])(\.[^'"\\\r\n]+)\1\s*\)''')
TAP_SUMMARY_RE = re.compile(r'^(?:ℹ|#)\s*(tests|pass|fail|skipped|cancelled)\s+(\d+)\s*$', re.M)
MAX_HTTP = 3 * 1024 * 1024
MAX_SOURCE = 40 * 1024 * 1024
USER_AGENT = 'Crownicles-RC0-Composer/1.0'


class RC0Error(RuntimeError):
    pass


def require_safe_rel(path: str) -> None:
    if (not isinstance(path, str) or not path or '\\' in path or '\x00' in path
            or path.startswith('/') or ':' in path.split('/')[0]
            or any(x in ('', '.', '..') for x in path.split('/'))):
        raise RC0Error('UNSAFE_PATH:' + repr(path))


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def is_plain_file(path: Path) -> bool:
    try:
        return stat.S_ISREG(path.lstat().st_mode)
    except FileNotFoundError:
        return False


def assert_no_symlink_components(path: Path) -> None:
    path = path.absolute()
    for part in (path, *path.parents):
        if part.is_symlink():
            raise RC0Error('SYMLINK_COMPONENT:' + str(part))


def safe_json(url: str) -> dict:
    allowed = f'https://api.github.com/repos/{REPOSITORY}/git/'
    if not url.startswith(allowed):
        raise RC0Error('URL_NOT_ALLOWED')
    request = Request(url, headers={'User-Agent': USER_AGENT,
                                    'Accept': 'application/vnd.github+json',
                                    'X-GitHub-Api-Version': '2022-11-28'})
    try:
        with urlopen(request, timeout=40) as response:
            payload = response.read(MAX_HTTP + 1)
    except Exception as exc:
        raise RC0Error('GITHUB_SOURCE_UNAVAILABLE:' + type(exc).__name__) from exc
    if len(payload) > MAX_HTTP:
        raise RC0Error('HTTP_LIMIT_EXCEEDED')
    try:
        obj = json.loads(payload)
    except ValueError as exc:
        raise RC0Error('GITHUB_JSON_INVALID') from exc
    if not isinstance(obj, dict):
        raise RC0Error('GITHUB_JSON_INVALID')
    return obj


def public_source_index() -> dict[str, dict]:
    api = f'https://api.github.com/repos/{REPOSITORY}/git'
    commit = safe_json(f'{api}/commits/{COMMIT}')
    if commit.get('sha') != COMMIT or commit.get('tree', {}).get('sha') != TREE:
        raise RC0Error('PUBLIC_COMMIT_TREE_DRIFT')
    tree = safe_json(f'{api}/trees/{TREE}?recursive=1')
    if tree.get('sha') != TREE or tree.get('truncated') is not False:
        raise RC0Error('PUBLIC_TREE_DRIFT')
    entries = tree.get('tree')
    if not isinstance(entries, list):
        raise RC0Error('PUBLIC_TREE_INVALID')
    result = {}
    for entry in entries:
        path = entry.get('path')
        require_safe_rel(path)
        if entry.get('type') == 'tree':
            continue
        if entry.get('type') != 'blob' or entry.get('mode') not in ('100644', '100755'):
            raise RC0Error('PUBLIC_NONREGULAR_FILE:' + path)
        if path in result or not re.fullmatch('[0-9a-f]{40}', str(entry.get('sha', ''))):
            raise RC0Error('PUBLIC_SHA_INVALID:' + path)
        size = entry.get('size')
        if not isinstance(size, int) or size < 0 or size > MAX_SOURCE:
            raise RC0Error('PUBLIC_SIZE_INVALID:' + path)
        result[path] = {'sha': entry['sha'], 'size': size, 'mode': entry['mode']}
    if len(result) != EXPECTED_FILES:
        raise RC0Error(f'PUBLIC_COUNT_DRIFT:{len(result)}')
    if result.get(TEST_FILE, {}).get('sha') != TEST_BLOB_BEFORE:
        raise RC0Error('PUBLIC_TEST_BLOB_DRIFT')
    return result


def verified_public_files(base: Path, index: dict[str, dict]) -> dict[str, bytes]:
    if not base.is_dir():
        raise RC0Error('SOURCE_BASE_MISSING')
    assert_no_symlink_components(base)
    expected_paths = set(index)
    found = set()
    data = {}
    for path in base.rglob('*'):
        assert_no_symlink_components(path)
        if path.is_dir():
            continue
        rel = path.relative_to(base).as_posix()
        if rel == 'CP058-LOCAL-EVIDENCE.json':
            continue
        require_safe_rel(rel)
        if rel not in expected_paths:
            raise RC0Error('SOURCE_UNEXPECTED_FILE:' + rel)
        if not is_plain_file(path):
            raise RC0Error('SOURCE_NONREGULAR_FILE:' + rel)
        b = path.read_bytes()
        if len(b) != index[rel]['size'] or git_blob(b) != index[rel]['sha']:
            raise RC0Error('SOURCE_BLOB_MISMATCH:' + rel)
        found.add(rel)
        data[rel] = b
    if found != expected_paths:
        raise RC0Error('SOURCE_INCOMPLETE:' + str(len(expected_paths - found)))
    return data


def patch_registry_only(public_files: dict[str, bytes]) -> None:
    body = public_files[TEST_FILE]
    if git_blob(body) != TEST_BLOB_BEFORE:
        raise RC0Error('REGISTRY_PATCH_SOURCE_MISMATCH')
    src = body.decode('utf-8')
    if src.count(OLD_TEST) != 1:
        raise RC0Error('REGISTRY_ASSERTION_NOT_UNIQUE')
    updated = src.replace(OLD_TEST, NEW_TEST, 1).encode('utf-8')
    if git_blob(updated) != TEST_BLOB_AFTER:
        raise RC0Error('REGISTRY_PATCH_SHA_MISMATCH')
    public_files[TEST_FILE] = updated


def js_code_mask(source: str) -> str:
    """Mask JavaScript comments, regex and quoted text without losing offsets.

    A require() in a quoted patch instruction must not become a dependency.
    Template interpolations remain executable code and are scanned recursively.
    This is a conservative *literal-require scanner*, not a full JS parser.
    """
    masked = list(source)
    n = len(source)
    regex_after_words = {'return', 'throw', 'case', 'delete', 'void', 'typeof',
                         'instanceof', 'in', 'of', 'yield', 'await', 'else', 'do'}

    def hide(a: int, b: int) -> None:
        for k in range(a, b):
            if source[k] not in '\r\n':
                masked[k] = ' '

    def quoted(i: int, quote: str) -> int:
        start = i
        i += 1
        while i < n:
            if source[i] == '\\':
                i += 2
            elif source[i] == quote:
                i += 1
                hide(start, i)
                return i
            else:
                i += 1
        raise RC0Error('JS_UNTERMINATED_STRING')

    def pattern(i: int) -> int:
        start = i
        i += 1
        inside_class = False
        while i < n:
            c = source[i]
            if c == '\\':
                i += 2
                continue
            if c in '\r\n':
                raise RC0Error('JS_UNTERMINATED_REGEX')
            if c == '[':
                inside_class = True
            elif c == ']':
                inside_class = False
            elif c == '/' and not inside_class:
                i += 1
                while i < n and (source[i].isalpha() or source[i] in '$'):
                    i += 1
                hide(start, i)
                return i
            i += 1
        raise RC0Error('JS_UNTERMINATED_REGEX')

    def template(i: int) -> int:
        hide(i, i + 1)
        i += 1
        start = i
        while i < n:
            c = source[i]
            if c == '\\':
                i += 2
                continue
            if c == '`':
                hide(start, i + 1)
                return i + 1
            if c == '$' and i + 1 < n and source[i + 1] == '{':
                hide(start, i + 2)
                i = code(i + 2, template_expression=True)
                start = i
                continue
            i += 1
        raise RC0Error('JS_UNTERMINATED_TEMPLATE')

    def code(i: int, *, template_expression: bool = False) -> int:
        depth = 1 if template_expression else 0
        regex_allowed = True
        while i < n:
            c = source[i]
            if c.isspace():
                i += 1
                continue
            if c in ('\'', '"'):
                i = quoted(i, c)
                regex_allowed = False
                continue
            if c == '`':
                i = template(i)
                regex_allowed = False
                continue
            if c == '/' and i + 1 < n and source[i + 1] == '/':
                start = i
                i = source.find('\n', i + 2)
                if i < 0:
                    i = n
                hide(start, i)
                continue
            if c == '/' and i + 1 < n and source[i + 1] == '*':
                end = source.find('*/', i + 2)
                if end < 0:
                    raise RC0Error('JS_UNTERMINATED_COMMENT')
                hide(i, end + 2)
                i = end + 2
                continue
            if c == '/' and regex_allowed:
                i = pattern(i)
                regex_allowed = False
                continue
            if c.isalpha() or c in '_$':
                start = i
                i += 1
                while i < n and (source[i].isalnum() or source[i] in '_$'):
                    i += 1
                regex_allowed = source[start:i] in regex_after_words
                continue
            if c.isdigit():
                i += 1
                while i < n and (source[i].isalnum() or source[i] in '._'):
                    i += 1
                regex_allowed = False
                continue
            if c == '{':
                if template_expression:
                    depth += 1
                regex_allowed = True
            elif c == '}':
                if template_expression:
                    depth -= 1
                    if depth == 0:
                        hide(i, i + 1)
                        return i + 1
                regex_allowed = False
            else:
                regex_allowed = c not in ')]' and c != '.'
            i += 1
        if template_expression:
            raise RC0Error('JS_UNTERMINATED_TEMPLATE_EXPR')
        return i

    code(0)
    return ''.join(masked)




def static_require_targets(name: str, content: bytes):
    if not name.endswith(('.js', '.cjs', '.mjs')):
        return
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError as exc:
        raise RC0Error('SOURCE_JS_ENCODING_INVALID:' + name) from exc
    mask = js_code_mask(text)
    for match in REQUIRE_RE.finditer(text):
        if mask[match.start():match.start() + len("require")] != "require":
            continue
        imp = match.group(2)
        target = posixpath.normpath(posixpath.join(posixpath.dirname(name), imp))
        if not target.endswith(('.js', '.cjs', '.mjs')):
            target += '.cjs'
        require_safe_rel(target)
        yield target


def recover_bridge_deps(files: dict[str, bytes], donor: Path) -> dict[str, dict]:
    if not donor.is_dir():
        raise RC0Error('BETA_BRIDGE_MISSING')
    assert_no_symlink_components(donor)
    queue = sorted(n for n in files if n.endswith(('.js', '.cjs', '.mjs')))
    seen = set()
    supplemental = {}
    while queue:
        name = queue.pop(0)
        if name in seen:
            continue
        seen.add(name)
        for target in static_require_targets(name, files[name]):
            if target not in files:
                if not (target.startswith('integral-native-router/src/')
                        and target.endswith('.cjs')
                        and len(PurePosixPath(target).parts) == 3):
                    raise RC0Error('MISSING_NON_BRIDGE_DEPENDENCY:' + name + '=>' + target)
                src = donor / PurePosixPath(target).name
                assert_no_symlink_components(src)
                if not is_plain_file(src):
                    raise RC0Error('MISSING_LOCAL_BRIDGE_DEPENDENCY:' + target)
                b = src.read_bytes()
                if len(b) > MAX_SOURCE:
                    raise RC0Error('BETA_BRIDGE_FILE_TOO_LARGE:' + target)
                files[target] = b
                supplemental[target] = {'sha256': hashlib.sha256(b).hexdigest(), 'size': len(b),
                                        'origin': 'LOCAL_BETA_BRIDGE_NOT_PUBLIC_GIT'}
                queue.append(target)
            elif target not in seen:
                queue.append(target)
    return dict(sorted(supplemental.items()))


def isolated_environment(dest: Path) -> dict[str, str]:
    home, tmp = dest / '.lab-home', dest / '.lab-tmp'
    home.mkdir(mode=0o700, exist_ok=True)
    tmp.mkdir(mode=0o700, exist_ok=True)
    # Do not inherit WhatsApp, OIDC, DB, MQTT, host agent or other secrets.
    env = {'PATH': os.environ.get('PATH', ''), 'HOME': str(home), 'TMPDIR': str(tmp),
           'NODE_ENV': 'test', 'CROWNICLES_OFFLINE_LAB': '1'}
    return env


def run_lab_tests(dest: Path, timeout: int) -> dict:
    tests = sorted(p.relative_to(dest).as_posix() for root in ('integral-native-router/beta',
                                                                'integral-native-router/test')
                   for p in (dest / root).glob('*.test.cjs'))
    if len(tests) != 47:
        raise RC0Error(f'UNEXPECTED_TEST_FILE_COUNT:{len(tests)}')
    node = shutil.which('node')
    if not node:
        raise RC0Error('NODE_MISSING')
    log = dest / 'RC0-TESTS.tap'
    with log.open('wb') as out:
        try:
            run = subprocess.run([node, '--test', *tests], cwd=dest,
                                 env=isolated_environment(dest), stdout=out,
                                 stderr=subprocess.STDOUT, timeout=timeout, check=False)
        except subprocess.TimeoutExpired as exc:
            raise RC0Error('TEST_TIMEOUT') from exc
    output = log.read_text('utf-8', errors='replace')
    summary = {k: int(v) for k, v in TAP_SUMMARY_RE.findall(output)}
    good = (run.returncode == 0 and summary.get('fail') == 0
            and summary.get('cancelled') == 0 and summary.get('pass', 0) > 0
            and summary.get('tests') == summary.get('pass', -1) + summary.get('skipped', 0))
    return {'process_exit': run.returncode, 'test_files': len(tests),
            'summary': summary, 'ok': good, 'log': log.name}


def prepare(base: Path, donor: Path, output: Path, *, index: dict[str, dict] | None = None,
            run_tests: bool = False, timeout: int = 900) -> dict:
    base, donor, output = base.absolute(), donor.absolute(), output.absolute()
    assert_no_symlink_components(base)
    assert_no_symlink_components(donor)
    assert_no_symlink_components(output.parent)
    if output.exists() or output.is_symlink():
        raise RC0Error('OUTPUT_ALREADY_EXISTS')
    if not output.parent.is_dir():
        raise RC0Error('OUTPUT_PARENT_MISSING')
    if output.is_relative_to(base) or output.is_relative_to(donor):
        raise RC0Error('OUTPUT_INSIDE_INPUT')
    index = index if index is not None else public_source_index()
    verified = verified_public_files(base, index)
    count = len(verified)
    patch_registry_only(verified)
    supplemental = recover_bridge_deps(verified, donor)
    # Exclusive mkdir is critical: never overwrite an output created concurrently.
    try:
        output.mkdir(mode=0o700, parents=False, exist_ok=False)
    except FileExistsError as exc:
        raise RC0Error('OUTPUT_ALREADY_EXISTS') from exc
    try:
        for name, b in sorted(verified.items()):
            loc = output / name
            loc.parent.mkdir(parents=True, exist_ok=True)
            loc.write_bytes(b)
            loc.chmod(0o700 if name in index and index[name].get('mode') == '100755' else 0o600)
        report = {'status': 'SOURCE_VERIFIED_ONLY', 'production_approved': False,
                  'public_repo': REPOSITORY, 'public_commit': COMMIT, 'public_tree': TREE,
                  'public_files_verified': count, 'test_fix_blob': TEST_BLOB_AFTER,
                  'donor_directory': str(donor), 'donor_files': supplemental,
                  'donor_files_count': len(supplemental),
                  'warnings': ['Composite source differs from original public commit',
                               'Local bridge modules do not have independently validated canonical provenance',
                               'All native E2E production gates remain open; no WhatsApp session is started',
                               'Static literal-require dependency inventory is not a full module/bundle audit'],
                  'tests': 'NOT_RUN'}
        (output / 'RC0-EVIDENCE.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    except BaseException:
        shutil.rmtree(output, ignore_errors=True)
        raise
    if run_tests:
        try:
            report['tests'] = run_lab_tests(output, timeout)
            report['status'] = 'LAB_TEST_PASS' if report['tests']['ok'] else 'LAB_TEST_FAIL'
        except RC0Error as exc:
            report['tests'] = {'ok': False, 'error': str(exc)}
            report['status'] = 'LAB_TEST_FAIL'
        (output / 'RC0-EVIDENCE.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, type=Path,
                        help='Unmodified CP058 verified checkout (e.g. ~/core-verificado)')
    parser.add_argument('--donor', required=True, type=Path,
                        help='Local beta bridge directory (never modified)')
    parser.add_argument('--output', required=True, type=Path,
                        help='New scratch directory; must not exist')
    parser.add_argument('--run-tests', action='store_true', help='Run all 47 public Node test files in isolated env')
    parser.add_argument('--timeout', type=int, default=900)
    args = parser.parse_args(argv)
    if not 60 <= args.timeout <= 1800:
        parser.error('--timeout must be between 60 and 1800 seconds')
    try:
        result = prepare(args.base.expanduser(), args.donor.expanduser(), args.output.expanduser(),
                         run_tests=args.run_tests, timeout=args.timeout)
        print(f"RC0_SOURCE_VERIFIED={result['public_files_verified']}/{EXPECTED_FILES}; "
              f"DONOR_ADDED={result['donor_files_count']}; STATUS={result['status']}")
        if isinstance(result['tests'], dict):
            print('RC0_TEST_RESULTS=' + json.dumps(result['tests'], ensure_ascii=False))
        print('RC0_REPORT=' + str(args.output.expanduser() / 'RC0-EVIDENCE.json'))
        return 0 if result['status'] != 'LAB_TEST_FAIL' else 1
    except RC0Error as exc:
        print('RC0_FAIL=' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
