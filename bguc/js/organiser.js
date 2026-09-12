// Compatibility stub. The admin module no longer has a login, so nothing here
// holds state. It exists only because browsers may still hold a cached copy of
// an older app.js or chrome.js that imports this file; without it, that failed
// import kills the whole module graph and the page renders blank.
// Safe to delete once no stale caches remain in the wild.

export function organiserSession() {
  return null;
}

export function organiserToken() {
  return null;
}

export function saveOrganiserSession() {}

export function clearOrganiserSession() {
  try {
    sessionStorage.removeItem("bguc-organiser");
    localStorage.removeItem("bgsu_admin");
  } catch {
    // Storage can be unavailable in private mode; nothing here is essential.
  }
}
