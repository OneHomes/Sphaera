import type { Tier } from "@/lib/businessActivityData";

// Real data now comes from the User + Team tables (see
// app/(app)/people/page.tsx) — the mock array that used to live here has
// been removed. This file only holds the shared type.

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
  tier: Tier;
};