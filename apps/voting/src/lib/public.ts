export const PUBLIC_PROJECT_COLUMNS =
  "id, project_code, model_name, description, category, class_group, cover_image_url, video_url, school_name, class_name, team_display_names, mentor_name, approval_status";

export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  if (!token) return false;
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export function parseStoragePath(value: string | null): { bucket: string; path: string } | null {
  if (!value) return null;
  if (value.startsWith("http")) return null;
  const [bucket, ...rest] = value.split("/");
  if (!bucket || rest.length === 0) return null;
  return { bucket, path: rest.join("/") };
}
