export function votingProjectUrl(projectId: string) {
  const configured = process.env.NEXT_PUBLIC_VOTING_SITE_URL?.trim();
  const base = (configured && configured.length > 0 ? configured : "http://localhost:3000").replace(/\/$/, "");
  return `${base}/projects/${projectId}`;
}
