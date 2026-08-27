import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      oid?: string;
      id?: string;
      role?: "AGENT" | "MANAGER" | "ADMIN";
      teamId?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
    graphError?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    oid?: string;
    userId?: string;
    role?: "AGENT" | "MANAGER" | "ADMIN";
    teamId?: string | null;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    graphError?: string;
  }
}