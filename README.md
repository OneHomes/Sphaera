# Sphaera Frontend — Full UI Layer (All Modules)

This is the complete frontend UI layer for the Sphaera MVP, built to match
the reference walkthrough (dark command-center aesthetic, persistent
leaderboard bar, icon-only left rail) and the full PRD feature set.

## What's included (all routes, all working, all verified)

| Route | Module | Notes |
|---|---|---|
| `/sign-in` | Auth | Real Microsoft Entra ID + **temporary** email/password testing path |
| `/command` | Janus Command Center | Suggested prompts + input bar (UI only, no AI backend yet) |
| `/dashboard` | Apex Edge Dashboard | Most in Demand, Active Leads, Monthly Sales, Pending, Productivity by Hour, Agent Activity Index |
| `/leads` | Lead Inbox | Filterable table — priority, stage, source, search |
| `/leads/[id]` | Lead 360 Profile | Timeline, notes, Janus summary, qualification, opportunity detail |
| `/pipeline` | Pipeline (Kanban) | Drag-and-drop stage changes, loss-reason modal |
| `/business-activity` | Business Activity (Apex Vision) | Agent/Campaign/Lead activity tables, mini calendar |
| `/aex` | AEX | Tier progress, points, badges, streaks, challenges, leaderboard |
| `/mail` | Mail | Native inbox UI (placeholder for real Gmail/M365 embed) |
| `/calendar` | Calendar | Native week view (placeholder for real Google Calendar/M365 embed) |
| `/messages` | Messages | Native chat UI (placeholder for real WhatsApp connector) |
| `/journal` | Journal | Folders + notes, matches AE21 |
| `/tasks` | Tasks | Completion toggle, source badges (user/manager/Janus/stage) |
| `/documents` | Documents | Document list with type badges |
| `/people` | People | Team directory |
| `/profile` | Profile | Real signed-in user info from the session |
| `/search` | Search | Cross-searches leads, opportunities, and documents |
| `/settings` | Settings | Notification and feature-flag toggles |

Every module reads from a `lib/*Data.ts` mock file — no real backend yet.
Each mock file has comments explaining exactly what real entity/API it
should be replaced with once the data layer is validated.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + lucide-react icons +
recharts (dashboard charts) + next-auth (Microsoft Entra ID). No other
external UI library — components are hand-built to match the reference
screens, using design tokens in `tailwind.config.ts` (`base.*` dark
surface scale, `status.*` active/inactive/alert, `tier.*` Gold/Silver/Bronze).

## Auth setup (do this before running)

Follow `ENTRA_ID_SETUP.md` to register the app in Azure Entra ID and get
your `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`.
Then:

```bash
cp .env.local.example .env.local
# fill in the four values described in .env.local.example
```

**Temporary testing shortcut:** the sign-in page also has a working
email/password form — any non-empty email and password signs you in
immediately, no real verification. This is wired via a `CredentialsProvider`
in `lib/auth.ts`, clearly marked `TEMPORARY — TESTING ONLY`. **Remove this
provider before UAT/production** — Sphaera's real and only production auth
method is Microsoft Entra ID (PRD PF01).

## Running locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/sign-in`. Sign in with
either method to reach `/command`, then use the left rail to explore every
module.

```bash
npm run build   # production build, verified clean (21/21 routes)
```

## Deploying to Azure Web App

Standard Next.js app — deploy via GitHub Actions to Azure App Service
(Node 20 runtime), or containerize with `node:20-slim` and push to Azure
Container Registry → Web App for Containers.

## Not built yet (next phase — backend/data, not frontend)

1. **Data layer connection** — everything above is mock data; real
   connection to Azure SQL/Cosmos DB waits on the Gold-layer data
   validation work (see `Sphaera_MVP_Build_Specification.md` Section 10).
2. **Janus real wiring** — every Janus touchpoint (command center, lead
   summary card, dashboard customization slot) is a placeholder; needs
   Azure AI Foundry + Azure AI Search RAG grounding.
3. **AEX real event engine** — the AEX page shows realistic mock data but
   there's no real point-calculation engine behind it yet.
4. **RBAC enforcement** — auth confirms *who* signed in, but there's no
   role/permission system yet (Sales Consultant vs Manager vs Admin views
   are currently identical).
5. **Real embedded Gmail/Calendar/WhatsApp** — `/mail`, `/calendar`,
   `/messages` are native Sphaera-built UIs with mock data, not actual
   embedded third-party views (that requires OAuth/API integration per
   the build spec's Section 4.5 "Embedded Third-Party Apps" requirement).
6. **Azure deployment itself** — no GitHub Actions workflow or App Service
   resource has been created yet.

See `Sphaera_MVP_Build_Specification.md` for the full spec this was built
from.
