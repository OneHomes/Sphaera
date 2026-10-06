import { prisma } from "./prisma";

// See the GraphToken model's comment in schema.prisma for why this
// exists — fixes a real HTTP 431 caused by storing large Graph tokens
// directly in the session cookie.

const GRAPH_SCOPES =
  "openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite OnlineMeetings.Read OnlineMeetingTranscript.Read.All";

export async function saveGraphToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  await prisma.graphToken.upsert({
    where: { userId },
    create: { userId, accessToken, refreshToken, expiresAt },
    update: { accessToken, refreshToken, expiresAt },
  });
}

async function refreshGraphToken(refreshToken: string) {
  const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID as string,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET as string,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: GRAPH_SCOPES,
    }),
  });

  const refreshed = await response.json();
  if (!response.ok) throw refreshed;
  return refreshed as { access_token: string; refresh_token?: string; expires_in: number };
}

/**
 * Returns a currently-valid Graph access token for this user, refreshing
 * it first if it's expired — this is the only thing lib/auth.ts's
 * session() callback needs to call; everything else (DB read, expiry
 * check, Microsoft refresh call, DB write-back) happens in here.
 */
export async function getValidGraphAccessToken(
  userId: string
): Promise<{ accessToken?: string; graphError?: string }> {
  const stored = await prisma.graphToken.findUnique({ where: { userId } });
  if (!stored) return {};

  if (stored.expiresAt.getTime() > Date.now()) {
    return { accessToken: stored.accessToken };
  }

  try {
    const refreshed = await refreshGraphToken(stored.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await saveGraphToken(
      userId,
      refreshed.access_token,
      refreshed.refresh_token ?? stored.refreshToken,
      expiresAt
    );
    return { accessToken: refreshed.access_token };
  } catch (err) {
    console.error("Failed to refresh Graph access token:", err);
    return { graphError: "RefreshAccessTokenError" };
  }
}
