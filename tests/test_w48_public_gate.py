"""Static fail-closed contract for the manual-only W48 MQTT broker lab.
These tests do NOT run GitHub Actions, Mosquitto, Core or user accounts.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/p0c-mosquitto-native-w46.yml"
W47_PROBE_SHA256 = "830f1638501477c943d4cc8303ce8b68dedaec0594a4283a01aa94204f5602c4"
PINNED_SOURCE_SHA = "83b1729055cbb4027b68208811450937deb1d90090d404eff4a2b48526177beb"
ALLOWED_REPO = "Otiosun/Crownicles-wa-lab"

class W48PublicGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.y = WORKFLOW.read_text(encoding="utf-8")
    def test_only_manual_trigger(self):
        self.assertRegex(self.y, r"(?m)^on:\s*\n  workflow_dispatch:\s*$")
        self.assertNotRegex(self.y, r"(?m)^  (push|pull_request|schedule|workflow_run|repository_dispatch):")
    def test_contents_read_only(self):
        self.assertRegex(self.y, r"(?m)^permissions:\s*\n  contents: read$")
        self.assertNotRegex(self.y, r"contents:\s*write")
    def test_exact_owner_repo_event_and_default_branch(self):
        m=re.search(r"(?m)^    if: (.*)$", self.y)
        self.assertIsNotNone(m)
        for value in (
            "github.repository == 'Otiosun/Crownicles-wa-lab'",
            "github.event_name == 'workflow_dispatch'",
            "github.ref == 'refs/heads/main'",
        ):
            self.assertIn(value,m.group(1))
        self.assertNotIn("github.event.repository.private",m.group(1))
    def test_early_shell_runtime_fence(self):
        s=self.y
        for exact in (
            'test "$GITHUB_REPOSITORY" = \'Otiosun/Crownicles-wa-lab\'',
            'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
            'test "$GITHUB_REF" = refs/heads/main',
            'test "$CROWNICLES_P0C_NO_PRODUCTION" = true',
            'test "$(id -u)" != 0',
        ):
            self.assertIn(exact,s)
    def test_W44_unchanged_auth_and_W47_code_pinned(self):
        self.assertIn(PINNED_SOURCE_SHA+"  candidate/bridge/mqtt-auth-lab.cjs",self.y)
        self.assertIn(W47_PROBE_SHA256+"  tools/w46_raw_mqtt_probe.cjs",self.y)
        import hashlib
        probe=ROOT/"tools/w46_raw_mqtt_probe.cjs"
        self.assertTrue(probe.is_file())
        self.assertEqual(hashlib.sha256(probe.read_bytes()).hexdigest(),W47_PROBE_SHA256)
    def test_mosquitto_is_temporary(self):
        for phrase in ("ubuntu-latest","timeout-minutes: 18","apt-get install -y --no-install-recommends mosquitto","sudo systemctl stop mosquitto"):
            self.assertIn(phrase,self.y)
        self.assertNotIn("production",self.y.lower().replace("no_production","").replace("production gate",""))
    def test_explicit_real_broker_required_and_never_homologated(self):
        for phrase in ("executedBroker","homologated","coreOriginalExecuted","subscriptionSemantics"):
            self.assertIn(phrase,self.y)
        self.assertIn("r.get('status')=='PASS'",self.y)
        self.assertIn("r.get('homologated') is False",self.y)
    def test_no_persistent_credentials_or_untrusted_events(self):
        self.assertNotRegex(self.y,r"(?i)(?:api[_-]?key|github_token|client_secret|wa_secret)\\s*[:=]")
        self.assertNotIn("pull_request_target:",self.y)
        self.assertNotIn("secrets.",self.y)
        self.assertNotIn("persist-credentials: true",self.y)
        self.assertIn("persist-credentials: false",self.y)

if __name__=="__main__":
    unittest.main()
