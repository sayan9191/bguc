export const copy = {
  org: "Basirhat Ganapati Utsab Committee",
  exhibition: "Science Exhibition",
  voteFavourite: "Vote for your favourite project",
  voteRule: "One user can give only one vote.",
  groupHint: "Group A · up to class 5 · Group B · class 6 onwards",
  allProjects: "All projects",
  groupA: "Group A",
  groupB: "Group B",
  search: "Search",
  searchPlaceholder: "Search projects, schools or students",
  view: "View",
  viewMore: "View more",
  vote: "Vote",
  signIn: "Sign in",
  signOut: "Sign out",
  leaderboard: "Leaderboard",
  projects: "Projects",
  studentPortal: "Student portal",
  admin: "Admin",
  noImage: "No image",
  votesCount: "votes",
};

export function t(key) {
  return copy[key] ?? key;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wordCount(text) {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function classOptions(selected) {
  const cur = String(selected ?? "").replace(/^Class\s+/i, "").trim();
  return Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${cur === String(n) ? "selected" : ""}>Class ${n}</option>`)
    .join("");
}

