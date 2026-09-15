import { prisma } from "./prisma";

// PRD PF07 (Audit Trail). Previously only 2 of the ~10 PRD event
// categories were logged (role/team changes, AEX anti-gaming rejections).
// This is the shared write path for the additional categories wired this
// pass: lead assignment/reassignment, material record changes (document
// upload/delete), communications sent, AI actions executed, and
// recognition/score changes (badge awards).

export const SYSTEM_ACTOR = {
  actorId: "system",
  actorEmail: "system@sphaera.internal",
};

export async function logAudit(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetId?: string;
  details: string;
}): Promise<void> {
  await prisma.auditLog.create({ data: params });
}
