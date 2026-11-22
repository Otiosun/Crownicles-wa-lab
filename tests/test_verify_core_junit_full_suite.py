"""Self-contained *synthetic XML* gate checks, not evidence of MariaDB execution."""
from __future__ import annotations
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent / 'tools' / 'verify_core_junit.py'
SPEC = importlib.util.spec_from_file_location('verify_core_junit', SCRIPT)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def make_report(*, only_extra=False, only_base=False):
    baseline = json.loads(gate.BASELINE_PATH.read_text())
    suites = {}
    if not only_extra:
        for cls, name in baseline['cases']:
            suites.setdefault(cls, []).append(name)
    if not only_base:
        suites[gate.EXTRA_SUITE] = [f'{gate.TARGET_SUITE} > {name}' for name in sorted(gate.EXPECTED_EXTRAS)]
    root = ET.Element('testsuites', tests=str(sum(len(v) for v in suites.values())), failures='0', errors='0', skipped='0')
    for cls, names in sorted(suites.items()):
        s = ET.SubElement(root, 'testsuite', name=cls, tests=str(len(names)), failures='0', errors='0', skipped='0')
        for name in names:
            ET.SubElement(s, 'testcase', name=name, classname=cls)
    return root


def xml(root):
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


class FullSuiteGateTests(unittest.TestCase):
    def assert_denied(self, root, contains=None):
        with self.assertRaises(gate.ReportError) as ctx:
            gate.inspect_xml(xml(root))
        if contains:
            self.assertIn(contains, str(ctx.exception))

    def test_01_full_177_and_exact_50_suites(self):
        result = gate.inspect_xml(xml(make_report()))
        self.assertTrue(result['approved'])
        self.assertEqual((result['cases'],result['baseline_cases'],result['equip_cases']), (177,170,7))

    def test_02_extra_seven_only_is_denied(self):
        # The original 5227-byte verifier falsely approved this, without the 170 upstream cases.
        self.assert_denied(make_report(only_extra=True), '50')

    def test_03_170_original_only_is_denied(self):
        self.assert_denied(make_report(only_base=True), '50')

    def test_04_missing_one_original_replaced_with_duplicate_same_count(self):
        root=make_report(); a=root.find('testsuite'); old=a.find('testcase'); old.set('name',a.findall('testcase')[1].get('name'))
        self.assert_denied(root, 'duplicado')

    def test_05_missing_original_replaced_with_arbitrary_name_same_total(self):
        root=make_report(); root.find('testsuite').find('testcase').set('name','invented original name')
        self.assert_denied(root,'divergentes')

    def test_06_seven_extra_only_new_test_replaces_correct_name(self):
        root=make_report(); s=[x for x in root.findall('testsuite') if x.get('name')==gate.EXTRA_SUITE][0]
        s.find('testcase').set('name', 'WhatsApp equipment action via native Core + disposable MariaDB schema > a fake passing test')
        self.assert_denied(root,'divergentes')

    def test_07_duplicate_suite_while_same_total_suites(self):
        root=make_report(); arr=root.findall('testsuite'); arr[1].set('name',arr[0].get('name'))
        self.assert_denied(root,'fora da suite')

    def test_08_forged_test_classname(self):
        root=make_report(); root.find('testsuite').find('testcase').set('classname','other-test.ts')
        self.assert_denied(root,'fora da suite')

    def test_09_extra_case_with_updated_counts(self):
        root=make_report(); s=root.find('testsuite'); ET.SubElement(s,'testcase', classname=s.get('name'),name='extra passing case')
        s.set('tests',str(int(s.get('tests'))+1));root.set('tests','178');self.assert_denied(root,'177')

    def test_10_skipped_case_child(self):
        root=make_report(); ET.SubElement(root.find('testsuite').find('testcase'),'skipped')
        self.assert_denied(root,'falhou/pulado')

    def test_11_failed_case_child(self):
        root=make_report(); ET.SubElement(root.find('testsuite').find('testcase'),'failure',message='boom')
        self.assert_denied(root,'falhou/pulado')

    def test_12_root_failure_summary(self):
        root=make_report();root.set('failures','1');self.assert_denied(root,'failures')

    def test_13_suite_skip_summary(self):
        root=make_report();root.find('testsuite').set('skipped','1');self.assert_denied(root,'skipped')

    def test_14_invalid_count_after_mutating_only_root(self):
        root=make_report();root.set('tests','7');self.assert_denied(root,'177')

    def test_15_doctype_rejected(self):
        payload=b'<!DOCTYPE foo [ <!ENTITY x "y"> ]>'+xml(make_report())
        with self.assertRaisesRegex(gate.ReportError,'DTD/ENTITY'):
            gate.inspect_xml(payload)

    def test_16_truncated_xml_denied(self):
        payload=xml(make_report())[:300]
        with self.assertRaises(gate.ReportError):gate.inspect_xml(payload)

    def test_17_missing_pinned_baseline_denied(self):
        fixture = xml(make_report())
        with patch.object(gate, 'BASELINE_PATH', Path('/definitely-not-present-core-junit-manifest.json')):
            with self.assertRaisesRegex(gate.ReportError, 'ausente'):
                gate.inspect_xml(fixture)

    def test_18_mutated_baseline_denied_even_if_valid_json(self):
        with tempfile.TemporaryDirectory() as d:
            m=json.loads(gate.BASELINE_PATH.read_text()); m['upstreamCommit']='wrong'
            path=Path(d)/'manifest.json';path.write_text(json.dumps(m))
            with patch.object(gate,'BASELINE_PATH',path):
                with self.assertRaisesRegex(gate.ReportError,'hash divergente'):
                    gate.inspect_xml(xml(make_report_ignoring_patched_baseline()))

    def test_19_root_must_be_valid_junit(self):
        root=make_report();root.tag='other'
        self.assert_denied(root,'raiz JUnit')

    def test_20_nested_rogue_case_denied(self):
        root=make_report(); extra=ET.SubElement(root,'testcase',classname='ignored',name='hidden');self.assert_denied(root,'fora de suite')

    def test_21_cli_success_and_missing_input_fail_closed(self):
        # CLI smoke without runner, JUnit is explicitly synthetic.
        import subprocess,sys
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/'synthetic-junit.xml';file.write_bytes(xml(make_report()))
            p=subprocess.run([sys.executable,str(SCRIPT),str(file)],capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr+p.stdout)
            self.assertIn('"cases": 177',p.stdout)
            q=subprocess.run([sys.executable,str(SCRIPT),str(Path(d)/'missing.xml')],capture_output=True,text=True)
            self.assertEqual(q.returncode,1)

def make_report_ignoring_patched_baseline():
    # Avoid patching fixture generator state when checking tampered file.
    with patch.object(gate, 'BASELINE_PATH', HERE.parent/'tools'/'core_pinned_junit_baseline.json'):
        return make_report()

if __name__=='__main__':
    unittest.main(verbosity=2)
