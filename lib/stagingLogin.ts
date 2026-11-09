import { createHash, timingSafeEqual } from "crypto";

// Password sign-in for non-production copies of the app (PR preview
// environments, localhost), so people can review a branch without
// registering every preview URL as an Entra redirect URI. Any existing
// Sphaera user can sign in with their email plus the shared
// STAGING_LOGIN_PASSWORD. It never writes to the database, and it is
// refused on the production domain even if the variable is set there by
// mistake — production stays Entra-only (PRD PF01).

const PRODUCTION_HOSTS = new Set(["apex.sphaera.tech"]);
const MIN_LENGTH = 16;

function configuredPassword(): string | null {
  const p = process.env.STAGING_LOGIN_PASSWORD;
  return p && p.length >= MIN_LENGTH ? p : null;
}

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined;

function header(headers: HeaderBag, name: string): string {
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get(name) ?? "";
  const v = headers[name];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// Checks both the forwarded and the direct host: behind Azure the public
// domain arrives in x-forwarded-host.
function isProductionRequest(headers: HeaderBag): boolean {
  return [header(headers, "x-forwarded-host"), header(headers, "host")]
    .flatMap((h) => h.split(","))
    .map((h) => h.trim().toLowerCase().split(":")[0])
    .some((h) => PRODUCTION_HOSTS.has(h));
}

export function stagingLoginAvailable(headers: HeaderBag): boolean {
  return configuredPassword() !== null && !isProductionRequest(headers);
}

export function matchesStagingPassword(input: string, headers: HeaderBag): boolean {
  const expected = configuredPassword();
  if (!expected || isProductionRequest(headers)) return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
