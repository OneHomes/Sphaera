import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getOrCreateUserByEmail } from "./currentUser";
import { logAudit, SYSTEM_ACTOR } from "./auditLog";
import { setLastAuthError } from "./debugAuthState"; // TEMPORARY, see that file
import { saveGraphToken, getValidGraphAccessToken } from "./graphTokenStore";

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
//
// HARDENING NOTE: the temporary email/password Credentials provider that
// existed during development has been removed. Microsoft Entra ID is now
// the ONLY sign-in method, matching PRD PF01 (Entra ID is the sole
// production auth method).
const GRAPH_SCOPES =
  "openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite OnlineMeetings.Read OnlineMeetingTranscript.Read.All";

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
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // On sign-in, resolve (or create) the real database User row and cache
    // its id/role/teamId onto the JWT. The Graph access/refresh tokens
    // themselves are NOT stored on the JWT (see GraphToken in
    // schema.prisma) — that used to bloat the session cookie enough to
    // trip an HTTP 431 in production. Refresh now happens lazily in the
    // session() callback via lib/graphTokenStore.ts.
    async jwt({ token, account, profile }) {
      if (account) {
        if (profile) {
          token.oid = (profile as { oid?: string }).oid;
        }
        if (token.email) {
          // NextAuth collapses any error thrown in this callback into a
          // generic ?error=Callback on the sign-in page with no detail —
          // this is the only place the real cause (e.g. the database
          // being unreachable) actually surfaces, so log it loudly.
          try {
            const dbUser = await getOrCreateUserByEmail(
              token.email,
              token.name,
              token.oid as string | undefined
            );
            token.userId = dbUser.id;
            token.role = dbUser.role as "AGENT" | "MANAGER" | "ADMIN";
            token.teamId = dbUser.teamId;
          } catch (err) {
            const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
            console.error("jwt callback: getOrCreateUserByEmail failed —", err);
            // TEMPORARY (remove once the real cause is found) — two
            // channels since we don't yet know if the DB itself is the
            // problem: in-memory always works (single-instance only),
            // AuditLog is durable/cross-instance but depends on the same
            // DB that might be the actual failure.
            setLastAuthError(`email=${token.email} :: ${message}`);
            logAudit({
              ...SYSTEM_ACTOR,
              action: "auth_callback_error",
              details: `email=${token.email} :: ${message}`,
            }).catch(() => {});
            throw err;
          }
        }

        // PRD AE01 — only set on an actual sign-in (this whole branch
        // only runs when NextAuth passes `account`, i.e. real
        // authentication, never on a resumed session from an existing
        // cookie), so this is a reliable "was this session just created"
        // signal for the daily welcome-screen gate (lib/dailyWelcome.ts).
        token.signedInAt = Date.now();

        // PF01 acceptance criterion — "all sign in ... events are
        // auditable." Also the real data source for daily/weekly active
        // use (PRD 5.2 #15/#16), which had no tracking at all before this.
        if (token.userId) {
          logAudit({
            actorId: token.userId as string,
            actorEmail: token.email ?? "unknown",
            action: "user_signed_in",
            details: `${token.name ?? token.email} signed in via Microsoft Entra ID`,
          }).catch((err) => console.error("Failed to audit sign-in:", err));
        }

        if (token.userId && account.access_token && account.refresh_token) {
          await saveGraphToken(
            token.userId as string,
            account.access_token,
            account.refresh_token,
            account.expires_at ? new Date(account.expires_at * 1000) : new Date(Date.now() + 3_600_000)
          ).catch((err) => console.error("Failed to save Graph token:", err));
        }

        return token;
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
      // own mailbox. The refresh token is NOT exposed here (lives only in
      // the GraphToken table) since it's longer-lived and more sensitive.
      //
      // The token itself now comes from the database, not the JWT —
      // fixes an HTTP 431 caused by storing it in the session cookie (see
      // GraphToken in schema.prisma). Refresh-if-expired happens inside
      // this one call.
      if (token.userId) {
        const { accessToken, graphError } = await getValidGraphAccessToken(token.userId as string);
        (session as { accessToken?: string }).accessToken = accessToken;
        (session as { graphError?: string }).graphError = graphError;
      }
      (session as { signedInAt?: number }).signedInAt = token.signedInAt as
        | number
        | undefined;

      return session;
    },
  },
};