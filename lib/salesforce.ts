import jwt from "jsonwebtoken";

// Salesforce integration — OAuth 2.0 JWT Bearer Flow via the "Sphaera
// Salesforce Integration" Connected App. Server-to-server: no user login,
// no refresh token to manage — a fresh JWT is signed and exchanged for an
// access token on every call. Fine for the current admin-triggered sync
// pattern; if this becomes high-frequency, cache the token until it
// expires (Salesforce access tokens are valid ~2h by default).

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

type TokenResponse = {
  access_token: string;
  instance_url: string;
  token_type: string;
};

async function getAccessToken(): Promise<TokenResponse> {
  const loginUrl = getEnv("SALESFORCE_LOGIN_URL");
  const clientId = getEnv("SALESFORCE_CLIENT_ID");
  const username = getEnv("SALESFORCE_USERNAME");
  const privateKey = getEnv("SALESFORCE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const assertion = jwt.sign(
    {
      iss: clientId,
      sub: username,
      aud: loginUrl,
      exp: Math.floor(Date.now() / 1000) + 3 * 60, // JWT itself just needs to live long enough for the token exchange
    },
    privateKey,
    { algorithm: "RS256" }
  );

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Salesforce auth failed: ${data.error} — ${data.error_description ?? "no description"}`
    );
  }
  return data;
}

export type SalesforceFieldMeta = {
  name: string;
  label: string;
  type: string;
  picklistValues: string[];
};

/** Fetches field metadata (names, types, picklist values) for a Salesforce object. */
export async function describeSalesforceObject(
  objectName: string
): Promise<SalesforceFieldMeta[]> {
  const { access_token, instance_url } = await getAccessToken();

  const res = await fetch(
    `${instance_url}/services/data/v60.0/sobjects/${objectName}/describe`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Salesforce describe failed: ${data.error_description ?? res.statusText}`);
  }

  type RawField = {
    name: string;
    label: string;
    type: string;
    picklistValues?: { value: string; active: boolean }[];
  };

  return (data.fields as RawField[]).map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    picklistValues: (f.picklistValues ?? []).filter((p) => p.active).map((p) => p.value),
  }));
}

/** Runs a SOQL query against Salesforce and returns the raw REST response. */
export async function querySalesforce(soql: string): Promise<{
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
}> {
  const { access_token, instance_url } = await getAccessToken();

  const res = await fetch(
    `${instance_url}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: { Authorization: `Bearer ${access_token}` },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const message = Array.isArray(data) ? data[0]?.message : data.error_description;
    throw new Error(`Salesforce query failed: ${message ?? res.statusText}`);
  }
  return data;
}
