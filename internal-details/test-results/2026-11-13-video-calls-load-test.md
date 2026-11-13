# Video calls: 10-call load test

**Date:** 13 Nov 2026 · **Result:** this VM records 4–5 calls at once. Live calls and transcription handle 10 calls without trouble. The test found a bot bug, which is now fixed.

## Setup

| | |
|---|---|
| VM | `vm-sphaera-video-01`, Central India, **D4as_v5 (4 vCPU / 16 GB)** |
| Running on it | LiveKit v1.13.11 (live video), Egress v1.15.0 (recording), call bot (transcription), Redis, Caddy |
| Recording format | One composite file per call: 854×480, 20 fps, H.264 at 700 kbps, AAC 64 kbps, MP4 to Azure Blob |
| Transcription | Azure Speech, `en-GB` + `ur-IN`, every speaker separately |

## How the test was run

- Script: [services/call-bot/loadtest.mjs](../../services/call-bot/loadtest.mjs), run from a dev machine:
  `CALLS=10 MINUTES=5 node --env-file=../../.env.local loadtest.mjs`
- It opened **10 calls at once** with 2 fake people each, **20 people in total**.
- Each person sent a moving test picture (640×360, 15 fps) and looped speech (English from the agent, Urdu from the client).
- The calls started 3 seconds apart and were then held for 5 minutes.
- Rooms were named `call-loadtest-…`, so nothing was written to the Sphaera database. All test recordings (18 files, 189 MB) were deleted afterwards.
- VM CPU and memory were sampled every 10 seconds with `docker stats`.

## Results

| Part | Load with 10 calls | Verdict |
|---|---|---|
| LiveKit (live video) | ~0.2 CPU, ~225 MB RAM | ✅ No problem |
| Call bot (transcription) | ~0.6–0.8 CPU, ~190 MB RAM, 20 voices | ✅ All 10 calls had captions the whole time |
| Recording (Egress) | ~2 CPU total, ~1.4 GB RAM | ❌ **Only 4–5 calls recorded at once** |
| Whole VM | 70–80% CPU busy, load average ~11 on 4 cores | ⚠️ Full |

More detail:

- **Per recording:** about **0.5 CPU on average**, rising to **~1.8 CPU for the first seconds** while Chrome starts.
- **Calls over the limit:** Egress refused to start them and the bot's start request timed out. The bot retries every 4 s, so a waiting call starts recording once another call ends. The start of that call is not in the recording. Transcription and Janus notes still cover every call.
- **File size:** a 6-minute recording was ~36 MB, which works out to **~360 MB per hour**.
- **Azure Speech:** 20 streams at once, no errors (the S0 limit is about 100).

## Bug found and fixed

- **What happened:** under load the bot ended live calls as "room closed" and stopped their recordings. One recording stopped at 0.3 MB.
- **Why:** the bot checks the rooms every 4 s. When starting a recording took longer than that, two checks ran at the same time. The older check held a room list from before the new room opened, so it treated that room as closed.
- **Fix:** only one check runs at a time, and starting a recording no longer holds up the check (commit `bdc44ac`).
- **Verified:** a second 10-call run for 2 minutes. Every room was joined once, and no call ended early.

## Capacity of this VM (D4as_v5)

| Calls at once | What happens |
|---|---|
| 1–4 | Everything works: video, recording, transcription, notes |
| 5–10 | Video and transcription work. Recording covers ~4 calls; the rest start recording late, when a slot frees up |
| 10+ | Not tested. Expect video quality to suffer because the CPU is already full at 10 |

## Re-run after any change to the VM or recording settings

1. Make sure no real calls are running. The script checks for live calls and refuses to start if it finds any.
2. Run `CALLS=10 MINUTES=5 node --env-file=../../.env.local loadtest.mjs` from `services/call-bot`.
3. On the VM, watch `sudo docker stats`, and grep the bot logs for `recording start failed` and `call finished`.
4. Delete the `call-loadtest-…` blobs from the `recordings` container.
5. Add the results here as a new dated file.
