#!/usr/bin/env python3
"""Offline adversarial regression suite for RC0 composer. No GitHub/bot needed."""
from __future__ import annotations

from contextlib import ExitStack
import hashlib
import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import os

SOURCE = Path(__file__).with_name('rc0-compose-crownicles-lab.py')
SPEC = importlib.util.spec_from_file_location('rc0_composer', SOURCE)
RC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RC)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='rc0-unit-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / 'public'
        self.donor = self.root / 'donor'
        self.base.mkdir()
        self.donor.mkdir()
        self.out = self.root / 'candidate'
        self.old = RC.OLD_TEST
        self.updated = RC.NEW_TEST
        self.write('integral-native-router/src/entry.cjs', "module.exports=require('./dep.cjs');\n")
        self.write(RC.TEST_FILE, "'use strict';\n" + self.old + "\n")
        self.write('integral-native-router/test/fixture.test.cjs',
                   "const test=require('node:test'); const assert=require('node:assert/strict');\n"
                   "const entry=require('../src/entry.cjs'); test('entry',()=>assert.equal(entry.answer,42));\n")
        self.add_donor('dep.cjs', "module.exports=require('./deep.cjs');\n")
        self.add_donor('deep.cjs', "module.exports={answer:42};\n")
        self.idx = {str(p.relative_to(self.base)).replace(os.sep, '/'):
                    {'sha': RC.git_blob(p.read_bytes()), 'size': p.stat().st_size}
                    for p in self.base.rglob('*') if p.is_file()}
        self.stack = ExitStack()
        self.stack.enter_context(patch.object(RC, 'TEST_BLOB_BEFORE',
                                               RC.git_blob(("'use strict';\n" + self.old + "\n").encode())))
        self.stack.enter_context(patch.object(RC, 'TEST_BLOB_AFTER',
                                               RC.git_blob(("'use strict';\n" + self.updated + "\n").encode())))
        self.addCleanup(self.stack.close)

    def write(self, relative, value):
        p = self.base / relative
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value)

    def add_donor(self, name, content):
        (self.donor / name).write_text(content)

    def prepare(self, *, output=None, run_tests=False):
        return RC.prepare(self.base, self.donor, output or self.out,
                          index=self.idx, run_tests=run_tests)

    def test_verifies_public_and_resolves_only_required_closure(self):
        rep = self.prepare()
        self.assertEqual(rep['status'], 'SOURCE_VERIFIED_ONLY')
        self.assertEqual(rep['donor_files_count'], 2)
        self.assertCountEqual(rep['donor_files'], ['integral-native-router/src/dep.cjs',
                                                   'integral-native-router/src/deep.cjs'])
        self.assertEqual((self.out / 'integral-native-router/src/deep.cjs').read_text(),
                         'module.exports={answer:42};\n')
        self.assertEqual((self.base / RC.TEST_FILE).read_text(), "'use strict';\n" + self.old + "\n")
        self.assertIn(self.updated, (self.out / RC.TEST_FILE).read_text())
        self.assertEqual(rep['donor_files']['integral-native-router/src/dep.cjs']['sha256'],
                         hashlib.sha256((self.donor / 'dep.cjs').read_bytes()).hexdigest())
        self.assertNotIn('DONOR_SECRET', (self.out / 'RC0-EVIDENCE.json').read_text())

    def test_patch_script_string_literal_require_is_not_a_dependency(self):
        # Exact causal shape of the public PR6 patch-gateway-v29.cjs source:
        # its patch anchor is TEXT, not executable require('./lote11.cjs').
        path = 'integral-native-router/beta/patches/patch-gateway-v29.cjs'
        self.write(path, "const fs=require('node:fs');\n"
                     "const importAnchor=\"const {x}=require('./lote11.cjs');\\n\";\n")
        f = self.base / path
        self.idx[path] = {'sha': RC.git_blob(f.read_bytes()), 'size': f.stat().st_size}
        rep = self.prepare()
        self.assertEqual(rep['donor_files_count'], 2)
        self.assertFalse((self.out / 'integral-native-router/beta/patches/lote11.cjs').exists())

    def test_quoted_comments_template_and_regex_not_imports(self):
        fake = ("const s='require(\"./phantom.cjs\")';\n"
                "// require('./line-fake.cjs')\n"
                "/* require('./block-fake.cjs') */\n"
                "const template=`require('./template-fake.cjs')`;\n"
                r"const matcher=/require\('\.\/regex-fake\.cjs'\)/;" + '\n')
        self.assertEqual(list(RC.static_require_targets('integral-native-router/src/entry.cjs',
                                                         fake.encode())), [])

    def test_real_import_nested_in_template_interpolation_is_preserved(self):
        script = "const x=`${require('./real.cjs').answer}`;\n"
        got = list(RC.static_require_targets('integral-native-router/src/entry.cjs',
                                             script.encode()))
        self.assertEqual(got, ['integral-native-router/src/real.cjs'])

    def test_unterminated_string_fails_closed(self):
        with self.assertRaisesRegex(RC.RC0Error, 'JS_UNTERMINATED_STRING'):
            list(RC.static_require_targets('integral-native-router/src/entry.cjs',
                                           b"const s='require('./shadow.cjs');"))

    def test_block_comment_import_is_not_dependency_but_real_is(self):
        script = ("/* require('../../outside.cjs') */\n"
                  "const dep = require('./dep.cjs');\n")
        got = list(RC.static_require_targets('integral-native-router/src/entry.cjs',
                                             script.encode()))
        self.assertEqual(got, ['integral-native-router/src/dep.cjs'])

    def test_mutated_public_file_fails_before_output(self):
        (self.base / 'integral-native-router/src/entry.cjs').write_text('mutated\n')
        with self.assertRaisesRegex(RC.RC0Error, 'SOURCE_BLOB_MISMATCH'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_missing_public_file_fails(self):
        (self.base / 'integral-native-router/src/entry.cjs').unlink()
        with self.assertRaisesRegex(RC.RC0Error, 'SOURCE_INCOMPLETE'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_unexpected_public_file_fails(self):
        (self.base / '.env').write_text('secret=1')
        with self.assertRaisesRegex(RC.RC0Error, 'SOURCE_UNEXPECTED_FILE'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_public_source_symlink_fails(self):
        p = self.base / 'integral-native-router/src/entry.cjs'
        p.unlink()
        p.symlink_to(self.base / RC.TEST_FILE)
        with self.assertRaisesRegex(RC.RC0Error, 'SYMLINK_COMPONENT'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_donor_symlink_fails(self):
        (self.donor / 'dep.cjs').unlink()
        (self.donor / 'dep.cjs').symlink_to(self.donor / 'deep.cjs')
        with self.assertRaisesRegex(RC.RC0Error, 'SYMLINK_COMPONENT'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_missing_local_donor_fails_before_output(self):
        (self.donor / 'deep.cjs').unlink()
        with self.assertRaisesRegex(RC.RC0Error, 'MISSING_LOCAL_BRIDGE_DEPENDENCY'):
            self.prepare()
        self.assertFalse(self.out.exists())

    def test_output_cannot_preexist(self):
        self.out.mkdir()
        (self.out / 'sentinel').write_text('DO NOT OVERWRITE')
        with self.assertRaisesRegex(RC.RC0Error, 'OUTPUT_ALREADY_EXISTS'):
            self.prepare()
        self.assertEqual((self.out / 'sentinel').read_text(), 'DO NOT OVERWRITE')

    def test_output_inside_public_source_forbidden(self):
        with self.assertRaisesRegex(RC.RC0Error, 'OUTPUT_INSIDE_INPUT'):
            self.prepare(output=self.base / 'child')
        self.assertFalse((self.base / 'child').exists())

    def test_output_inside_donor_forbidden(self):
        with self.assertRaisesRegex(RC.RC0Error, 'OUTPUT_INSIDE_INPUT'):
            self.prepare(output=self.donor / 'child')
        self.assertFalse((self.donor / 'child').exists())

    def test_unknown_outside_bridge_import_fails(self):
        entry = self.base / 'integral-native-router/src/entry.cjs'
        entry.write_text("require('../../outside.cjs');\n")
        self.idx['integral-native-router/src/entry.cjs'] = {
            'sha': RC.git_blob(entry.read_bytes()), 'size': entry.stat().st_size}
        with self.assertRaisesRegex(RC.RC0Error, 'MISSING_NON_BRIDGE_DEPENDENCY'):
            self.prepare()

    def test_illegal_traversal_import_fails(self):
        entry = self.base / 'integral-native-router/src/entry.cjs'
        entry.write_text("require('../../../outside.cjs');\n")
        self.idx['integral-native-router/src/entry.cjs'] = {
            'sha': RC.git_blob(entry.read_bytes()), 'size': entry.stat().st_size}
        with self.assertRaisesRegex(RC.RC0Error, 'UNSAFE_PATH'):
            self.prepare()

    def test_duplicate_or_unknown_registry_patch_fails(self):
        testpath = self.base / RC.TEST_FILE
        testpath.write_text("'use strict';\n" + self.old + '\n' + self.old + '\n')
        self.idx[RC.TEST_FILE] = {'sha': RC.git_blob(testpath.read_bytes()), 'size': testpath.stat().st_size}
        with self.assertRaisesRegex(RC.RC0Error, 'REGISTRY_PATCH_SOURCE_MISMATCH'):
            self.prepare()

    def test_existing_cp058_evidence_is_ignored_but_not_trusted(self):
        (self.base / 'CP058-LOCAL-EVIDENCE.json').write_text('{"faked":"true"}')
        rep = self.prepare()
        self.assertEqual(rep['public_files_verified'], len(self.idx))
        self.assertFalse((self.out / 'CP058-LOCAL-EVIDENCE.json').exists())

    def test_only_explicit_test_flag_runs_node(self):
        self.prepare()
        self.assertEqual(__import__('json').loads((self.out / 'RC0-EVIDENCE.json').read_text())['tests'],
                         'NOT_RUN')
        self.assertFalse((self.out / 'RC0-TESTS.tap').exists())

    def test_smoke_node_actual_test_process(self):
        # Create a real 47-file Node test suite to exercise subprocess summary and env.
        p = self.base / 'integral-native-router/test/fixture.test.cjs'
        template = p.read_text()
        for i in range(1, 46):
            file = self.base / f'integral-native-router/test/fixture{i:02}.test.cjs'
            file.write_text(template)
            relative = file.relative_to(self.base).as_posix()
            self.idx[relative] = {'sha': RC.git_blob(file.read_bytes()), 'size': file.stat().st_size}
        # The pinned registry test also matches *.test.cjs, totaling 47 files.
        # Make its fixture executable under node:test while preserving exact assertion.
        names = ['expeditionResolve','friendlyFight','guildCreate','guildDescription',
                 'guildElderRemove','guildKick','guildLeave','petCaress','petFree',
                 'petTransfer','ping','unlock']
        registry = ','.join(repr(n) + ':{}' for n in names)
        reg_src = ("const test=require('node:test'); const assert=require('node:assert/strict');\n"
                   + 'const U={NATIVE:{' + registry + '}};\n'
                   + "test('registry',()=>{" + self.old + "});\n")
        reg_dst = reg_src.replace(self.old, self.updated)
        reg = self.base / RC.TEST_FILE
        reg.write_text(reg_src)
        self.idx[RC.TEST_FILE] = {'sha': RC.git_blob(reg.read_bytes()), 'size': reg.stat().st_size}
        self.stack.enter_context(patch.object(RC, 'TEST_BLOB_BEFORE', RC.git_blob(reg_src.encode())))
        self.stack.enter_context(patch.object(RC, 'TEST_BLOB_AFTER', RC.git_blob(reg_dst.encode())))
        if not __import__('shutil').which('node'):
            self.skipTest('Node runtime not present')
        rep = self.prepare(run_tests=True)
        self.assertEqual(rep['status'], 'LAB_TEST_PASS', rep['tests'])
        self.assertEqual(rep['tests']['test_files'], 47)
        self.assertEqual(rep['tests']['summary']['pass'], 47)
        self.assertEqual(rep['tests']['summary']['fail'], 0)

    def test_test_process_failure_does_not_claim_success(self):
        with patch.object(RC, 'run_lab_tests', return_value={
                'ok': False, 'process_exit': 1, 'summary': {'tests': 3, 'pass': 2, 'fail': 1}}):
            rep = self.prepare(run_tests=True)
        self.assertEqual(rep['status'], 'LAB_TEST_FAIL')
        self.assertTrue(self.out.exists())
        self.assertIn('LAB_TEST_FAIL', (self.out / 'RC0-EVIDENCE.json').read_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
