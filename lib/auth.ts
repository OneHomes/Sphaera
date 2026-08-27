import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateUserByEmail } from "./currentUser";

// Reads the three values you get from the Entra ID App Registration:
// tenant ID, client (application) ID, and client secret.
// See ENTRA_ID_SETUP.md for how to create these in the Azure portal.
//
// The `scope` here requests Microsoft Graph Mail + Calendar permissions
// on top of standard sign-in scopes, so the access token we get back can
// call Graph on the signed-in user's behalf (lib/graph.ts). These must
// also be added + admin-consented under API permissions on the App
// Registration in the Azure portal, or the token Microsoft issues won't
// actually carry them.
const GRAPH_SCOPES =
  "openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID as string,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET as string,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
        scope: GRAPH_SCOPES,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error("Failed to refresh Graph access token:", err);
    return { ...token, graphError: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID as string,
      authorization: {
        params: { scope: GRAPH_SCOPES },
      },
    }),

    // TEMPORARY — TESTING ONLY. Accepts any non-empty email/password with
    // no real verification. This exists purely so the app can be exercised
    // locally without a full Entra ID round trip every time. Per PRD PF01,
    // Sphaera's real (and only production) sign-in method is Microsoft
    // Entra ID. REMOVE this provider entirely before UAT/production —
    // it must never reach a deployed/shared environment. Note: this
    // provider cannot get a Graph access token, so Mail/Calendar won't
    // work when signed in this way — expected, since it's Entra-only.
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
    // On sign-in, resolve (or create) the real database User row and cache
    // its id/role/teamId onto the JWT, and capture the Graph
    // access/refresh tokens. Refresh happens automatically here whenever
    // the cached access token has expired.
    async jwt({ token, account, profile }) {
      if (account) {
        if (profile) {
          token.oid = (profile as { oid?: string }).oid;
        }
        if (token.email) {
          const dbUser = await getOrCreateUserByEmail(
            token.email,
            token.name,
            token.oid as string | undefined
          );
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.teamId = dbUser.teamId;
        }

        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;

        return token;
      }

      if (
        token.accessTokenExpires &&
        Date.now() < (token.accessTokenExpires as number)
      ) {
        return token;
      }

      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { oid?: string }).oid = token.oid as
          | string
          | undefined;
        (session.user as { id?: string }).id = token.userId as
          | string
          | undefined;
        (session.user as { role?: string }).role = token.role as
          | string
          | undefined;
        (session.user as { teamId?: string | null }).teamId = token.teamId as
          | string
          | null
          | undefined;
      }

      // NOTE (security trade-off, documented deliberately): the Graph
      // access token is attached to `session` so both server components
      // and our own API routes can call Microsoft Graph on the user's
      // behalf via getServerSession(). Because NextAuth's built-in
      // /api/auth/session route serializes whatever `session` returns,
      // an already-authenticated user could see their OWN short-lived
      // (~1hr) token via devtools — there is no cross-user exposure, and
      // the token only grants Mail/Calendar access to that same user's
      // own mailbox. The refresh token is deliberately NOT exposed here
      // (kept only in the encrypted JWT) since it's longer-lived and more
      // sensitive.
      (session as { accessToken?: string }).accessToken = token.accessToken as
        | string
        | undefined;
      (session as { graphError?: string }).graphError = token.graphError as
        | string
        | undefined;

      return session;
    },
  },
};