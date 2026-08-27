import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern — prevents creating a new PrismaClient
// (and new DB connection pool) on every hot-reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}