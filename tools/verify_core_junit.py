#!/usr/bin/env python3
"""Fail-closed verifier for authentic Crownicles Core/MariaDB integration results.

An XML report cannot prove which database was used; the isolated GitHub Action
must also check pinned upstream ref, disposable MariaDB service and process exit.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

LIMIT = 15_000_000
SOURCE_FILE = 'wa-equip-action.integration.test.ts'
TARGET_SUITE = 'WhatsApp equipment action via native Core + disposable MariaDB schema'
EXPECTED = frozenset({
    'equips reserve item, persists active slot and returns refreshed categories',
    'swaps two real items without duplicating inventory state',
    'deposit moves equipped item to reserve when inventory has capacity',
    'no active item: deposit rejected with no mutation',
    'missing reserve item is rejected and cannot equip invented items',
    "a player's context cannot alter another player's inventory",
    'CoreHandlers responds with official packet and writes the same database state',
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

    suites = [root] if tag(root) == 'testsuite' else [n for n in root.iter() if tag(n) == 'testsuite']
    if not suites:
        raise ReportError('nenhuma testsuite')
    cases = [n for n in root.iter() if tag(n) == 'testcase']
    if not cases:
        raise ReportError('nenhum testcase')
    declared_tests = quantity(root, 'tests', required=True)
    if declared_tests != len(cases):
        raise ReportError(f'tests declarado={declared_tests}, observado={len(cases)}')

    for node in [root, *[x for x in suites if x is not root]]:
        for attr in ('errors', 'failures', 'skipped'):
            if quantity(node, attr) != 0:
                raise ReportError(f'{tag(node)} com {attr} != 0')
        declared = node.get('tests')
        if declared is not None and tag(node) == 'testsuite':
            seen_in_suite = sum(1 for c in node.iter() if tag(c) == 'testcase')
            if quantity(node, 'tests') != seen_in_suite:
                raise ReportError(f'testsuite declara {declared}, contem {seen_in_suite}')

    ownership: dict[int, str] = {}
    for suite in suites:
        for child in list(suite):
            if tag(child) == 'testcase':
                ownership[id(child)] = suite.get('name') or ''

    counts: dict[str, int] = {}
    for case in cases:
        name = case.get('name')
        if not name:
            raise ReportError('testcase sem name')
        source = case.get('classname') or ownership.get(id(case), '')
        from_candidate = SOURCE_FILE in source or SOURCE_FILE in ownership.get(id(case), '')
        if from_candidate:
            for expected in EXPECTED:
                if name == expected or name == f'{TARGET_SUITE} > {expected}':
                    counts[expected] = counts.get(expected, 0) + 1
                    break
        for n in case.iter():
            if n is case:
                continue
            if tag(n) in ('failure', 'error', 'skipped'):
                raise ReportError(f'testcase falhou/pulado: {name}')

    absent = sorted(name for name in EXPECTED if counts.get(name, 0) != 1)
    if absent:
        raise ReportError('cenarios ausentes/duplicados: ' + ', '.join(absent))
    return {
        'approved': True,
        'status': 'CORE_MARIADB_EQUIP_CANDIDATE_VERIFIED',
        'cases': len(cases),
        'equip_cases': len(EXPECTED),
        'qualification': 'relatorio JUnit estruturalmente integro; exige tambem job MariaDB real com sucesso',
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
