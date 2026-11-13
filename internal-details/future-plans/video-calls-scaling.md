# Video calls: scaling plan

**Agreed:** 13 Nov 2026 · **Based on:** [10-call load test](../test-results/2026-11-13-video-calls-load-test.md)

Recording is the only bottleneck. Live video (LiveKit), transcription (bot plus Azure Speech) and Janus notes already handle 10 calls at once on today's VM.

## Stage 1: now (testing phase), no change

- Keep the single VM: **D4as_v5 (4 vCPU)**.
- It records **~4 calls at once**. Extra calls start recording late, but transcription and notes still cover them.
- **Why we wait:** a bigger VM costs about 4× as much and would sit mostly idle during testing.

## Stage 2: pilot with more users, resize the same VM

**When:** 3–4 or more calls at once becomes normal, or the whole team starts using video calls.

- **Change:** resize `vm-sphaera-video-01` to **D16as_v5 (16 vCPU)**. That gives **~12–14 recordings at once**.
- **How:** in the Azure portal, Stop the VM, change its Size, then Start it. This takes about 5–10 minutes of downtime, so do it outside working hours. No code changes are needed.
- **After the resize:** retune `cpu_cost.room_composite_cpu_cost` in `~/livekit/egress.yaml`. It is 2.0 today; the measured average is ~0.5 CPU and the start-up peak ~1.8, so try about 1.0. Then re-run the load test and save the results.

**Check before resize day:**

1. **vCPU quota.** Subscriptions often allow only 10 vCPU per region by default. Raise the **Dasv5 family quota in Central India** to at least 16 under Subscriptions → Usage + quotas. Approval can take a day.
2. **Static public IP.** The IP `20.219.28.119` must not change on stop and start. Check that the IP is set to "Static", or the video domain's DNS will need updating.

## Stage 3: production (~200 users, 10+ calls at once), split into 2 VMs

| VM | Runs | Size (starting point) |
|---|---|---|
| Video VM (current one) | LiveKit, call bot, Redis, Caddy | D4as_v5 is enough (~1 CPU used at 10 calls) |
| Recording VM (new) | Egress only, connected to the same Redis | D8as_v5 records ~8 calls; D16as_v5 records ~14 |

**Why split:** heavy recording can no longer slow down live calls. If the recording VM dies, calls go on; only recording stops.

**How it works:** Egress instances share the work through Redis, so we add the new VM with no code change. To record more calls later, add more recording VMs, or a scale set that grows and shrinks with demand.

## Options kept in reserve

- **Per-person recording instead of one composite file.** This uses about 5–10× less CPU because no Chrome runs, but it produces one file per person. Playback would then need two players in sync, or a nightly job that merges the files. Use it if recording costs become a problem.
- **LiveKit Cloud as an emergency fallback.** If the video VM goes down, point `LIVEKIT_URL` at LiveKit Cloud. Only the URL and keys change.

## Ops items to do alongside

- **Auto-shutdown:** it is 9 PM PKT today. Move it to after working hours, or late calls will fail.
- **CPU alert:** set an Azure Monitor alert for when VM CPU stays above 70% for 5 minutes, emailed to the team.
- **Storage:** recordings are never deleted. They move from Hot to Cold after 30 days and to Archive after 180 days. At ~360 MB per hour, 10 calls of 30 minutes a day add about 1.8 GB a day.
