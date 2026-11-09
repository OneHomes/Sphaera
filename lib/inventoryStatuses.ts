// Client-safe: no Prisma. InventoryPage (a client component) needs these, and
// importing them from lib/inventoryData pulled Prisma, and with it the
// server-only AsyncLocalStorage tenant context, into the browser bundle,
// crashing /inventory with "AsyncLocalStorage is not a constructor".
export const UNIT_STATUSES = ["available", "reserved", "sold", "blocked"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
