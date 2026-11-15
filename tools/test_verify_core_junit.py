"""Independent offline test suite for strict JUnit gate; no external services."""
from __future__ import annotations

import unittest
from xml.sax.saxutils import escape
from verify_core_junit import EXPECTED, ReportError, inspect_xml


def xml(names=None, attrs='', roots='testsuites', nested='', vitest=False, classname=True):
    from verify_core_junit import TARGET_SUITE, SOURCE_FILE
    names = sorted(EXPECTED) if names is None else names
    def case(name):
        title = (TARGET_SUITE + ' > ' + name) if vitest and name in EXPECTED else name
        source = f' classname="__tests__-integration/handlers/{SOURCE_FILE}"' if classname else ''
        return f'<testcase{source} name="{escape(title, {chr(34): "&quot;"})}"></testcase>'
    cases = ''.join(case(name) for name in names)
    count = len(names)
    t = f'<testsuite name="__tests__-integration/handlers/wa-equip-action.integration.test.ts" tests="{count}" failures="0" errors="0" skipped="0">{cases}{nested}</testsuite>'
    if roots == 'testsuite':
        return t.encode()
    return f'<testsuites tests="{count}" failures="0" errors="0" skipped="0"{attrs}>{t}</testsuites>'.encode()


class XMLGateTests(unittest.TestCase):
    def allowed(self, data):
        self.assertTrue(inspect_xml(data)['approved'])

    def blocked(self, data):
        with self.assertRaises(ReportError):
            inspect_xml(data)

    def test_complete(self): self.allowed(xml())
    def test_real_vitest_full_names(self): self.allowed(xml(vitest=True))
    def test_real_vitest_xml_header(self):
        self.allowed(b'<?xml version="1.0" encoding="UTF-8" ?>' + xml(vitest=True))
    def test_from_wrong_file_rejected(self):
        self.blocked(xml(vitest=True).replace(b'wa-equip-action.integration.test.ts', b'other-test.integration.test.ts'))
    def test_extra_upstream_cases(self): self.allowed(xml(sorted(EXPECTED) + ['upstream regression']))
    def test_single_suite_root(self): self.allowed(xml(roots='testsuite'))
    def test_missing_candidate(self): self.blocked(xml(sorted(EXPECTED)[:-1]))
    def test_duplicate_candidate(self): self.blocked(xml(sorted(EXPECTED) + [sorted(EXPECTED)[0]]))
    def test_truncated_xml(self): self.blocked(xml()[:-12])
    def test_doctype(self): self.blocked(b'<!DOCTYPE testsuites>' + xml())
    def test_entity(self): self.blocked(b'<!ENTITY x SYSTEM "file:///etc/passwd">' + xml())
    def test_skipped_case(self): self.blocked(xml(nested='<testcase name="n"><skipped/></testcase>').replace(b'tests="7"', b'tests="8"'))
    def test_failed_case(self): self.blocked(xml(nested='<testcase name="n"><failure/></testcase>').replace(b'tests="7"', b'tests="8"'))
    def test_mismatched_root_count(self): self.blocked(xml().replace(b'tests="7"', b'tests="8"', 1))
    def test_mismatched_suite_count(self):
        data=xml(); ix=data.index(b'<testsuite name='); self.blocked(data[:ix]+data[ix:].replace(b'tests="7"',b'tests="9"',1))
    def test_bad_root(self): self.blocked(b'<random tests="7"/>')
    def test_no_cases(self): self.blocked(b'<testsuite tests="0"/>')
    def test_non_utf8(self): self.blocked(b'\xff<testsuite tests="7"/>')
    def test_synthetic_metrics_failure(self): self.blocked(xml().replace(b'failures="0"',b'failures="1"',1))
    def test_max_size(self): self.blocked(xml() + b' '*15_000_000)
    def test_case_without_name(self): self.blocked(xml(nested='<testcase/>').replace(b'tests="7"',b'tests="8"'))
    def test_duplicate_vitest_full_name(self):
        self.blocked(xml(sorted(EXPECTED) + [sorted(EXPECTED)[0]], vitest=True))
    def test_unrelated_upstream_case_skipped(self):
        data=xml(sorted(EXPECTED)+['other']).replace(b'name="other"></testcase>', b'name="other"><skipped/></testcase>')
        self.blocked(data)

if __name__ == '__main__': unittest.main()
