// Organiser session token, kept in sessionStorage so it dies with the tab.
// The token comes from the organiser_login database function; the password
// itself never reaches this code.
const KEY = "bguc-organiser";

export function organiserSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || !session.expires_at || new Date(session.expires_at) <= new Date()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function organiserToken() {
  return organiserSession()?.token ?? null;
}

export function saveOrganiserSession(token, expiresAt) {
  sessionStorage.setItem(KEY, JSON.stringify({ token, expires_at: expiresAt }));
}

export function clearOrganiserSession() {
  sessionStorage.removeItem(KEY);
  localStorage.removeItem("bgsu_admin");
}
