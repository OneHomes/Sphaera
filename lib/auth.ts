import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

// Reads the three values you get from the Entra ID App Registration:
// tenant ID, client (application) ID, and client secret.
// See ENTRA_ID_SETUP.md for how to create these in the Azure portal.
export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID as string,
    }),

    // TEMPORARY — TESTING ONLY. Accepts any non-empty email/password with
    // no real verification. This exists purely so the app can be exercised
    // locally without a full Entra ID round trip every time. Per PRD PF01,
    // Sphaera's real (and only production) sign-in method is Microsoft
    // Entra ID. REMOVE this provider entirely before UAT/production —
    // it must never reach a deployed/shared environment.
    CredentialsProvider({
      name: "Email and Password (testing only)",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return {
          id: credentials.email,
          name: credentials.email.split("@")[0],
          email: credentials.email,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // Carry the Entra ID object ID (oid) and role claims (if configured
    // in the App Registration's token configuration) onto the session,
    // so RBAC checks later in the build can read them directly.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.oid = (profile as { oid?: string }).oid;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { oid?: string }).oid = token.oid as
          | string
          | undefined;
      }
      return session;
    },
  },
};
