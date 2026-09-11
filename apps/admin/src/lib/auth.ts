export const ADMIN_COOKIE = "bgsu_admin";

/**
 * Organiser credentials come from the environment only. Nothing is hardcoded,
 * so no password is ever committed. Set these in apps/admin/.env.local:
 *   ADMIN_USERNAME, ADMIN_PASSWORD
 * ADMIN_SESSION_SECRET is optional and signs the cookie with its own key.
 */
function clean(value: string | undefined) {
  return (value ?? "").replace(/\r/g, "").trim();
}

function adminUser() {
  return clean(process.env.ADMIN_USERNAME);
}

function adminPass() {
  return clean(process.env.ADMIN_PASSWORD);
}

function sessionSecret() {
  return clean(process.env.ADMIN_SESSION_SECRET) || adminPass();
}

export function adminAuthConfigured() {
  return Boolean(adminUser() && adminPass());
}

export function expectedAdminUser() {
  return adminUser();
}

export function verifyAdminLogin(username: string, password: string) {
  if (!adminAuthConfigured()) return false;
  return clean(username) === adminUser() && clean(password) === adminPass();
}

async function hmacHex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAdminSessionToken() {
  return hmacHex(sessionSecret(), `ok:${adminUser()}`);
}

export async function isValidAdminSession(token: string | undefined | null) {
  if (!token || !adminAuthConfigured()) return false;
  const expected = await createAdminSessionToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
