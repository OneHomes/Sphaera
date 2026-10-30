/**
 * Finance screens that filter their data by the user's departments. A department-scoped user
 * sees only these; every other Finance screen shows company-wide data and is blocked for them.
 * Kept free of server imports so the sidebar (a client component) can use it.
 */
export const DEPARTMENT_SCOPED_PATHS: readonly string[] = [
  "/finance",
  "/finance/budget",
  "/finance/explorer",
  "/finance/payments",
  "/finance/overheads",
  "/finance/needs-allocation",
  "/finance/disputes",
  "/finance/historical-debt",
  "/finance/weekly-brief",
];
