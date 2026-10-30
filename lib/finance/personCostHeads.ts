// People Costs lines use the ledger's "Simple cost head" list (FinanceManagementCostHead), so a
// line and its payment always show the same head. Lines saved before 2026-10-30 hold the old
// v41 categories ("Salary", "Commission", ...); these map onto the equivalent cost head for
// display and for the ledger. No database imports here: shared by server and client code.

export const LEGACY_PERSON_COST_TYPES = ["Salary", "Commission", "Bonus", "Employer taxes", "Benefits", "Other personnel"] as const;
const LEGACY_SET = new Set<string>(LEGACY_PERSON_COST_TYPES);

/** Heads that describe staff pay; a non-personnel head set by hand on a payment is respected. */
export const PERSONNEL_COST_HEADS = new Set([
  "Salaries",
  "Commissions",
  "Commissions Agent",
  "Bonuses & Incentives",
  "Employer Payroll Taxes",
  "Staff Benefits & Pensions",
]);

export function isLegacyPersonCostType(value: string): boolean {
  return LEGACY_SET.has(value);
}

/** The cost head a line's stored value stands for ("Salary" -> "Salaries"; a head stays as is). */
export function personCostHead(costType: string): string {
  switch (costType) {
    case "Salary":
    case "Other personnel":
      return "Salaries";
    case "Commission":
      return "Commissions";
    case "Bonus":
      return "Bonuses & Incentives";
    case "Employer taxes":
      return "Employer Payroll Taxes";
    case "Benefits":
      return "Staff Benefits & Pensions";
    default:
      return costType;
  }
}

/** Cost-per-person columns. */
export function personCostColumn(costType: string): "salary" | "commission" | "other" {
  const head = personCostHead(costType);
  if (head === "Salaries") return "salary";
  if (head === "Commissions" || head === "Commissions Agent") return "commission";
  return "other";
}
