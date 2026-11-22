#!/usr/bin/env python3
"""Fail-closed Crownicles Core/MariaDB JUnit gate for a PINNED upstream tree.

Checks the exact 170 test identities from TWO independent successful upstream
runs at the pinned commit, plus exactly seven WhatsApp equipment scenarios.

The report alone cannot attest that MariaDB was used, that the original
source was built, or that the lab was isolated. The workflow must check those
conditions independently and fail on a nonzero Core process exit status.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

LIMIT = 15_000_000
PINNED_COMMIT = '64d08c05f11949029317341735f6f73024f19f9b'
BASELINE_PATH = Path(__file__).with_name('core_pinned_junit_baseline.json')
BASELINE_SHA256 = '07499bd7447d6e0fa4e8ab4745327d8b111aa96060347db262d8592d68cdcdf7'
SOURCE_FILE = 'wa-equip-action.integration.test.ts'
EXTRA_SUITE = '__tests__-integration/handlers/' + SOURCE_FILE
TARGET_SUITE = 'WhatsApp equipment action via native Core + disposable MariaDB schema'
EXPECTED_EXTRAS = frozenset({
    'equips reserve item, persists active slot and returns refreshed categories',
    'swaps two real items without duplicating inventory state',
    'deposit moves equipped item to reserve when inventory has capacity',
    'no active item: deposit rejected with no mutation',
    'missing reserve item is rejected and cannot equip invented items',
    "a player's context cannot alter another player's inventory",
    'CoreHandlers responds with official packet and writes the same database state',
})
EXPECTED_ARTIFACT_SHA256 = frozenset({
    '442e8e98655973bb2ba54054c0139a048cd0396fa111a9bf1fbffd1601613d26',
    'd80f7650e05d58c6e1ad355f2ff95e4b95937e0e6e43fde809e08d8b267f8764',
})

class ReportError(Exception):
    pass


def tag(element: ET.Element) -> str:
    return element.tag.split('}', 1)[-1]


def quantity(node: ET.Element, name: str, required: bool = False) -> int:
    raw = node.get(name)
    if required and raw is None:
        raise ReportError(f'{tag(node)}: atributo {name} ausente')
    if raw is None:
        return 0
    try:
        n = int(raw)
    except (TypeError, ValueError) as exc:
        raise ReportError(f'{tag(node)}: {name} invalido') from exc
    if n < 0 or str(n) != raw or n > 10_000_000:
        raise ReportError(f'{tag(node)}: {name} fora dos limites')
    return n


def load_baseline() -> tuple[Counter[tuple[str, str]], Counter[str]]:
    try:
        raw = BASELINE_PATH.read_bytes()
    except OSError as exc:
        raise ReportError('manifesto JUnit pinado ausente ou ilegivel') from exc
    if hashlib.sha256(raw).hexdigest() != BASELINE_SHA256:
        raise ReportError('manifesto JUnit com hash divergente')
    try:
        m = json.loads(raw)
        if m['schema'] != 'crownicles-core-pin-junit-cases-v1' or m['upstreamCommit'] != PINNED_COMMIT:
            raise ReportError('commit/schema do baseline divergente')
        if m['baselineCases'] != 170 or m['baselineSuites'] != 49:
            raise ReportError('contagens do baseline incorretas')
        artifact_shas = {a['artifactZipSha256'] for a in m['junitArtifacts']}
        if artifact_shas != EXPECTED_ARTIFACT_SHA256 or len(m['junitArtifacts']) != 2:
            raise ReportError('fontes do baseline divergentes')
        pairs = [tuple(x) for x in m['cases']]
        suite_names = list(m['suites'])
    except (ValueError, TypeError, KeyError, IndexError) as exc:
        raise ReportError('manifesto JUnit invalido') from exc
    if (len(pairs) != 170 or len(set(pairs)) != 170 or
        len(suite_names) != 49 or len(set(suite_names)) != 49 or
        not all(len(p) == 2 and all(isinstance(x, str) and x for x in p) for p in pairs)):
        raise ReportError('identidades baseline ausentes/duplicadas')
    if any(c not in suite_names for c, _ in pairs):
        raise ReportError('baseline sem suite do testcase')
    return Counter(pairs), Counter(suite_names)


def inspect_xml(payload: bytes) -> dict:
    if not isinstance(payload, bytes) or not payload or len(payload) > LIMIT:
        raise ReportError('relatorio ausente, grande demais ou invalido')
    if any(x in payload.upper() for x in (b'<!DOCTYPE', b'<!ENTITY')):
        raise ReportError('DTD/ENTITY proibidas')
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        raise ReportError(f'XML malformado: {exc}') from exc
    if tag(root) not in ('testsuites', 'testsuite'):
        raise ReportError('raiz JUnit invalida')
    # Reject status tags at ANY depth, including direct suite/root children.
    # JUnit attributes may be forged as zero while an actual failure node remains.
    for element in root.iter():
        if tag(element) in ('failure', 'error', 'skipped'):
            raise ReportError('testcase/suite falhou/pulado: status presente no XML')

    suites = [root] if tag(root) == 'testsuite' else [s for s in root if tag(s) == 'testsuite']
    if len(suites) != 50:
        raise ReportError(f'numero de suites incorreto: {len(suites)} != 50')
    # Reject unowned testcase elements placed outside a suite or nested suites.
    cases = [c for s in suites for c in s if tag(c) == 'testcase']
    if len(cases) != 177 or quantity(root, 'tests', required=True) != 177:
        raise ReportError(f'relatorio nao contem os 177 testes pinados (observado {len(cases)})')
    if len(list(root.iter('testcase'))) != len(cases):
        raise ReportError('testcase aninhado/fora de suite')
    for node in [root, *[s for s in suites if s is not root]]:
        for attr in ('errors', 'failures', 'skipped'):
            if quantity(node, attr) != 0:
                raise ReportError(f'{tag(node)} com {attr} != 0')
        if tag(node) == 'testsuite' and quantity(node, 'tests', required=True) != len([c for c in node if tag(c) == 'testcase']):
            raise ReportError('testsuite com contagem diferente do conteudo')

    observed = Counter()
    suite_names = Counter()
    for suite in suites:
        name = suite.get('name')
        if not name:
            raise ReportError('testsuite sem name')
        suite_names[name] += 1
        for case in suite:
            if tag(case) != 'testcase':
                continue
            case_name = case.get('name')
            cls = case.get('classname')
            if not case_name or not cls or cls != name:
                raise ReportError('testcase sem identidade ou fora da suite indicada')
            observed[(cls, case_name)] += 1
            if observed[(cls, case_name)] > 1:
                raise ReportError('testcase duplicado')
            for child in case.iter():
                if child is not case and tag(child) in ('failure', 'error', 'skipped'):
                    raise ReportError(f'testcase falhou/pulado: {case_name}')

    baseline_cases, baseline_suites = load_baseline()
    extras = Counter({(EXTRA_SUITE, f'{TARGET_SUITE} > {name}'): 1 for name in EXPECTED_EXTRAS})
    expected_cases = baseline_cases + extras
    expected_suites = baseline_suites + Counter({EXTRA_SUITE: 1})
    if observed != expected_cases:
        missing = list((expected_cases - observed).elements())[:4]
        unexpected = list((observed - expected_cases).elements())[:4]
        raise ReportError(f'casos originais/WhatsApp divergentes: missing={missing!r} extra={unexpected!r}')
    if suite_names != expected_suites:
        raise ReportError('identidades das 50 suites divergentes')
    return {
        'approved': True,
        'status': 'CORE_MARIADB_EQUIP_PINNED_FULL_SUITE_VERIFIED',
        'upstream_commit': PINNED_COMMIT,
        'cases': len(cases),
        'baseline_cases': 170,
        'baseline_suites': 49,
        'equip_cases': len(EXPECTED_EXTRAS),
        'qualification': 'identidades do JUnit verificadas; exige processo Core e MariaDB real aprovados no CI',
    }


def main() -> int:
    if len(sys.argv) != 2:
        print('USO: python tools/verify_core_junit.py <caminho.xml>', file=sys.stderr)
        return 2
    try:
        report = inspect_xml(Path(sys.argv[1]).read_bytes())
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ReportError) as exc:
        print(json.dumps({'approved': False, 'reason': str(exc)}, ensure_ascii=False))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
