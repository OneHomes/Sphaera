import { prisma } from "../prisma";
import { revisionItems, type RevisionItem } from "./changeJournal";
import { personCostHead } from "./personCostHeads";

/**
 * Ledger -> People Costs direction of the link (the other direction is planLedgerDepartments in
 * peopleOverheadsData.ts). A payment reclassified in the ledger (payment detail form, bulk
 * reclassify, cost head merge) passes its new Simple cost head / department on to its People
 * Costs lines, so People Costs and Spending Explorer never disagree. Returns before/after
 * snapshots for the caller's change-journal entry, so ONE Undo reverts the ledger and the lines.
 */
export async function syncPersonLinesToLedger(params: {
  transactionIds: string[];
  department?: string | null;
  costHead?: string | null;
  /** Cost head merge: only lines currently on this head (old categories that stand for it included). */
  onlyCostHead?: string;
}): Promise<{ before: RevisionItem[]; after: RevisionItem[] }> {
  const data: { costType?: string; departmentSnapshot?: string } = {};
  if (params.costHead) data.costType = params.costHead;
  if (params.department) data.departmentSnapshot = params.department;
  if (!params.transactionIds.length || !Object.keys(data).length) return { before: [], after: [] };

  const lines: { id: string; costType: string; departmentSnapshot: string | null }[] = [];
  for (let i = 0; i < params.transactionIds.length; i += 1000) {
    lines.push(
      ...(await prisma.financePersonCostAllocation.findMany({
        where: { transactionId: { in: params.transactionIds.slice(i, i + 1000) } },
        select: { id: true, costType: true, departmentSnapshot: true },
      }))
    );
  }
  const changing = lines.filter(
    (l) =>
      (!params.onlyCostHead || personCostHead(l.costType) === params.onlyCostHead) &&
      ((data.costType !== undefined && l.costType !== data.costType) ||
        (data.departmentSnapshot !== undefined && l.departmentSnapshot !== data.departmentSnapshot))
  );
  if (!changing.length) return { before: [], after: [] };

  const ids = changing.map((l) => l.id);
  const before = await revisionItems("FinancePersonCostAllocation", ids);
  for (let i = 0; i < ids.length; i += 1000) {
    await prisma.financePersonCostAllocation.updateMany({ where: { id: { in: ids.slice(i, i + 1000) } }, data });
  }
  const after = await revisionItems("FinancePersonCostAllocation", ids);
  return { before, after };
}
