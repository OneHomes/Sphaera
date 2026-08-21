import type { Tier } from "@/lib/businessActivityData";

// Placeholder data only. Real version reads from User + Team entities
// once Entra ID group membership / role assignment is wired in.

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
  tier: Tier;
};

export const teamMembers: TeamMember[] = [
  { id: "u1", name: "Agent 1", role: "Sales Consultant", team: "Team A", email: "agent1@onehomes.com", tier: "Gold" },
  { id: "u2", name: "Agent 2", role: "Sales Consultant", team: "Team A", email: "agent2@onehomes.com", tier: "Gold" },
  { id: "u3", name: "Agent 3", role: "Sales Consultant", team: "Team A", email: "agent3@onehomes.com", tier: "Gold" },
  { id: "u4", name: "Agent 4", role: "Booker / Lead Qualifier", team: "Team B", email: "agent4@onehomes.com", tier: "Gold" },
  { id: "u5", name: "Agent 5", role: "Sales Consultant", team: "Team B", email: "agent5@onehomes.com", tier: "Silver" },
  { id: "u6", name: "Agent 6", role: "Sales Consultant", team: "Team B", email: "agent6@onehomes.com", tier: "Silver" },
  { id: "u7", name: "Priya Sharma", role: "Team Manager", team: "Team A", email: "priya.sharma@onehomes.com", tier: "Gold" },
  { id: "u8", name: "Yunus Khan", role: "Sales / Commercial Director", team: "All Teams", email: "yunus@onehomes.com", tier: "Gold" },
];
