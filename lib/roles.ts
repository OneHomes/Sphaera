// Role lives here as an application-level TypeScript union, not a Prisma
// enum, because Azure SQL Server doesn't support native enum types
// (confirmed by Prisma error P1012). The database column is a plain
// string; this type is what enforces the allowed values in code.
export type Role = "AGENT" | "MANAGER" | "ADMIN";

export const ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];