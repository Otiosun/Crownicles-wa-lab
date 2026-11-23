# Crownicles W47 — causal denial proof and native runner dispatch gate

**Status:** DRAFT; parent PR #9; Core 6.2.0.b commit `64d08c05f11949029317341735f6f73024f19f9b`; Base40 canon SHA256 `557751ca8a26fb094bc3fbd037453058fc8b6e0183d4e1ffed72b6e43e1f1847`. **Not integrated or homologated.**

## Falsifiable P0-C bug and scoped fix

The W46 R3 real-broker probe declared that an unauthorized QoS0 PUBLISH had not leaked after merely `sleep(450ms)`. Under a slow FIFO broker this is an **unsound negative assertion**: a forbidden publication may not have been processed at the point of assertion. We reproduced RED with a mock queue introducing 60–80 ms of unauthorized-message processing delay and a 1 ms test window, not with Mosquitto itself.

W47 changes only `tools/w46_raw_mqtt_probe.cjs` and its test: after an unauthorized publish on each MQTT client connection, that **same TCP stream** sends an authorized publication with a random fence body; the test waits for both authorized fence deliveries. Under FIFO broker processing, observing these deliveries proves that each preceding unauthorized publish was processed before evaluating message isolation. It still waits a bounded additional interval for illegal deliveries. Missing fences are **FAIL** (not silently accepted). W44 authentication files and credentials are untouched.

- Source Git blob pre `bf0caa20bf9c81097e4cc160219a29c4e6fba850`, post `b3d4e117f65c202e6534652b8b0ea553612c60c9`.
- Test Git blob pre `9352a21b16f151d9afb0cfb5ef65cd7adad40137`, post `4d9be84dab443e70f783b9b2c7e577a8ff5d2f99`.
- RED W46 original with 28 total tests: **23 PASS / 5 FAIL** (the five W47 negative/fence tests).
- GREEN W47 with the same 28 tests: **28 PASS / 0 FAIL / 0 SKIP**. Two new cases use a real local TCP socket with a **fake** MQTT broker enforcing deterministic FIFO delay; **they are not native Mosquitto tests**.

## Native runner still blocked: two independent preconditions

1. GitHub Actions private runner on `Otiosun/Crownicles-wa-lab` historically failed at **0 steps** for the relevant manual workflow; job 137346061542, attempt2 run 43749412124. See private issue #7. This result does not identify billing, permissions or runner root cause. The repository owner must inspect the job's UI annotation and Settings/Actions/Billing or obtain GitHub Support clarification. **Do not rerun blindly**.
2. The W46 Mosquitto workflow `.github/workflows/p0c-mosquitto-native-w46.yml` currently exists **only on the draft PR #9 branch**. According to the [GitHub `workflow_dispatch` docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), the workflow must exist in the **default branch** for the normal manual trigger. Therefore a draft branch alone is not a runnable lab. A reviewed, owner-authorized workflow registration in an isolated private repository's default branch (or an approved, carefully scoped merge of the workflow definition) is required before any manual dispatch. This is not permission to merge PR #9 or #10 now.

## Safe execution acceptance

Once a private runner is available and the manually triggered workflow is registered as required:

- Confirm the SHA-256 of the unmodified W44 auth module is `83b1729055cbb4027b68208811450937deb1d90090d404eff4a2b48526177beb`, and the W47 files match the pinned post-Git blobs.
- Run `node --test tools/w46_raw_mqtt_probe.test.cjs` (local protocol only), then `node tools/w46_raw_mqtt_probe.cjs "$PWD/candidate/bridge/mqtt-auth-lab.cjs"` **as non-root** in an ephemeral runner with actual Mosquitto and `mosquitto_passwd` installed.
- Only the native broker JSON `status=PASS` with `executedBroker=true`, both legal directions delivered, denied read **not delivered**, denied write **not delivered**, actual broker closed and files cleaned, would prove the **broker-only** component. It must still report `homologated=false`, `coreOriginalExecuted=false`.
- Core compiled with MQTT credential shim, MariaDB GAME+LOGS, signed request / actor correlation, duplicate/restart behavior and WhatsApp E2E remain independent gates. **Never mark 8/8 or activate a bot based on this probe alone.**

No deploy, runner dispatch, merge, production credentials, MariaDB, bot or CANON change performed by W47. Target integration is review of stacked PR #10 into draft PR #9, not production.
