// TEMPORARY — delete this file and its one call site (lib/auth.ts) and
// the app/api/debug/last-auth-error route once the real cause of the
// production sign-in failure is found.
//
// In-memory, not the database: if the sign-in failure IS the database
// being unreachable, writing the error record to that same database
// would fail too. This works as long as the follow-up read hits the
// same serverless instance that just handled the failing sign-in —
// usually true for two quick sequential requests, not guaranteed.
let lastAuthError: { message: string; at: string } | null = null;

export function setLastAuthError(message: string): void {
  lastAuthError = { message, at: new Date().toISOString() };
}

export function getLastAuthError() {
  return lastAuthError;
}
