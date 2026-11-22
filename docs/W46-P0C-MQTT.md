# W46 — P0-C real MQTT broker gate (draft, manual-only)

Scope: private isolated **Mosquitto 2.x** on `127.0.0.1`, W44’s exact source-pinned `createBrokerConfig`, two distinct ephemeral clients, **real MQTT 3.1.1 packets over TCP** implemented with Node built-ins. No production credentials, no Core database, no WhatsApp and no player data.

This is an **independent second implementation of the broker acceptance test**, not the first-party Core native E2E. It removes the npm `mqtt` dependency from W44’s original broker probe so a runner only needs Node 24 and OS `mosquitto` plus `mosquitto_passwd` to test ACL. The module **refuses** to start when the W44 file SHA-256 differs from `83b1729055cbb4027b68208811450937deb1d90090d404eff4a2b48526177beb`.

## Local procedure — no production

From an isolated, writable clone of this **private lab repository** (run as an unprivileged user):

```sh
node --test tools/w46_raw_mqtt_probe.test.cjs
node tools/w46_raw_mqtt_probe.cjs "$PWD/candidate/bridge/mqtt-auth-lab.cjs"
```

`BLOCKED` exit 2 means prerequisites missing (for example `MOSQUITTO_BINARIES_MISSING` or root user). `FAIL` exit 1 means the broker or protocol check failed. `PASS` exit 0 requires an actual spawned Mosquitto process and proves: no anonymous access, bad password rejected, valid Core/Gateway logins, both authorized directions delivered, cross-topic **delivery** rejected even when SUBACK grants an unauthorized subscription, and forbidden publishes not delivered. Report is one sanitized JSON record with `homologated:false`. The test also refuses false confidence from a copied or mutated W44 source.

## CI / provenance

Only a **manual** `workflow_dispatch` under `.github/workflows/p0c-mosquitto-native-w46.yml`, `contents:read`, on a private disposable GitHub runner. It does not execute on push or pull_request. It pins the untouched W44 module SHA `83b172...`, original W44 proof SHA `8b6106...`, and W46 raw probe SHA pinned (v2; see workflow), uses Node 24 and OS Mosquitto; no secret input, no production service, no direct Core access. It must be reviewed and merged on the private lab main branch before workflow dispatch is possible; **this draft PR does not start CI**.

Do not store generated `password_file`, `acl_file`, raw MQTT payloads or credentials as artifacts. W44 transient password-file conversion uses a 0600 plaintext fixture inside a private 0700 temp directory; SIGKILL before conversion may leave those ephemeral credentials on disk. Never use real production credentials. A non-root broker process is mandatory because Mosquitto may drop privileges and lose access to 0600 broker files when started as root.

## Important native Mosquitto ACL semantics (W46 v2 correction)

The original W44 native-broker-probe required SUBACK return 0x80 for unauthorized topics. With Mosquitto **file** ACLs, an unauthorized SUBSCRIBE may be accepted and still correctly receive **no** messages; consequently W44's criterion can falsely fail a secure broker. Confirmed from Eclipse Mosquitto issue #2296 (maintainer `ralight`, 2021) and MQTT protocol: <https://github.com/eclipse-mosquitto/mosquitto/issues/2296>. W44's source is preserved unchanged for provenance, **but its strict cross-SUBACK assertion is NOT the W46 admission criterion**.

W46 v2 accepts SUBACK 0 or 128 for nonpermitted exact topics and wildcard prefixes, then validates at the message-delivery boundary: authorized messages are delivered to their intended role, forbidden cross-topic subscriptions reveal nothing, and forbidden publishers cannot inject messages. Any cross-topic delivery causes FAIL. The offline unit suite proves RED for the old `SUBACK == 128` criterion and GREEN for secure `SUBACK == 0`, plus leak-negative cases. This still requires a **real Mosquitto process** for a native PASS; local mocks do not count.

## Explicit limits / gate

Local 20/20 Node codec, ACL policy unit tests and a simulated loopback TCP server do **not** prove Mosquitto native ACL. Real broker PASS does **not** prove Core compiled on Node 24/TS6, request attestation and replay binding (W20/W22), MariaDB GAME+LOGS, two real players, async notifications outside the two W44 topics, WhatsApp E2E, restart and all-writers ACK. Those are independent gates; **8/8 remain OFF** until tested and approved.

Original upstream pinned commit: `64d08c05f11949029317341735f6f73024f19f9b`; Core/package.json `mqtt=5.15.2` (W46 raw test does not use it). Original W44 checkpoint in Drive `17Tequ29QbF0A6CleFXhMI5bwqwGPDnci`; Canonical Base40 `1Dk3Qu-Y24aJZu0jYJRXG4RlFQEN7_uCv`. This branch is for the **lab only**, not the Crownicles canonical archive.

Main blocker: GitHub private Actions runs in the target repo have failed before executing steps (issue #7); root cause is not established. This manual-only workflow may remain BLOCKED until the owner resolves runner availability. No retries or workflow_dispatch should be performed just to increase a test count.
