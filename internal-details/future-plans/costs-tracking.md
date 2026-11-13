# Costs tracking

**Built:** 13 Nov 2026 · **Page:** `https://apex.sphaera.tech/internal/costs` (not in the menu; only the emails in `lib/costs/access.ts` can open it)

## What it shows

| Section | Source | Real or estimate |
|---|---|---|
| Azure bill by resource (VM, Static Web App, SQL, Storage, Speech, AI Foundry, …) | Azure Cost Management API | **Real** (Azure updates it a few times a day) |
| Janus by feature | Every `askJanus` call records its model and tokens | Estimate (list prices) |
| By person | Janus, speech and recording costs for each user | Estimate |
| Video calls | Per call: transcription minutes, Janus notes, recording size | Estimate |
| Every request | One row per paid request: who, what, tokens or seconds, time taken, cost | Estimate |

- **Data:** the `usage_events` table, written by `lib/costs/usage.ts`.
- **Prices:** set in `lib/costs/pricing.ts`. Check them when the model or region changes.
- **Start date:** tracking began on 13 Nov 2026. The first test call before that was backfilled for speech and recording only, without Janus tokens.

## One-time setup still needed (Sardar)

The real Azure bill needs two things:

1. **Role assignment:**
   - Azure portal → Subscriptions → "Onehomes Azure (sphaera-onyx)" → Access control (IAM) → Add role assignment.
   - Role: **Cost Management Reader**.
   - Member: Sphaera's sign-in **app registration**, the same one whose client ID is in `AZURE_AD_CLIENT_ID`.
2. **App setting:** in Static Web App "Sphaera-Web" → Environment variables, add `AZURE_COST_SUBSCRIPTION_ID` = the subscription ID (a GUID, shown on the subscription's Overview page).

The page shows these steps itself until both are done.

## Later ideas

- Monthly budget per feature with an alert when Janus spend jumps.
- Cost per lead / per agent trend over months.

## Change log

- **13 Nov 2026: transcription cost halved.**
  - **Change:** the call bot now mixes each call's voices into one Azure Speech stream instead of one stream per person.
  - **Price:** 1 hour of call ≈ $1 transcription (was ≈ $2). Nothing is sent while nobody with a microphone is in the room.
  - **Speaker names:** each sentence is labelled with whoever was loudest while it was said, using the bot's own per-person audio. In the self-test, English went to the agent and Urdu to the client, both correctly.
  - **Known limit:** when two people talk over each other, the whole sentence goes to the louder one.
