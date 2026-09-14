export const copy = {
  org: "Basirhat Ganapati Utsab Committee",
  exhibition: "Science Exhibition",
  voteFavourite: "Vote for your favourite project",
  voteRule: "Each person can give 3 votes in Group A and 3 votes in Group B.",
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

const NUMBERED_CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function normalizeClass(value) {
  return String(value ?? "")
    .replace(/^Class\s+/i, "")
    .trim();
}

/** True when a saved class is free text such as "Nursery" rather than 1-12. */
export function isOtherClass(value) {
  const cur = normalizeClass(value);
  return cur !== "" && !NUMBERED_CLASSES.includes(cur);
}

export function classOptions(selected) {
  const cur = normalizeClass(selected);
  const numbered = NUMBERED_CLASSES.map(
    (n) => `<option value="${n}" ${cur === n ? "selected" : ""}>Class ${n}</option>`
  ).join("");
  return `${numbered}<option value="other" ${isOtherClass(selected) ? "selected" : ""}>Other</option>`;
}

