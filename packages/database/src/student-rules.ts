export const PROJECT_DESC_MIN_WORDS = 20;
export const PROJECT_DESC_MAX_WORDS = 150;
export const PROJECT_NAME_MAX_WORDS = 12;
export const PROJECT_MAX_PHOTOS = 3;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let ten = digits;
  if (digits.length === 12 && digits.startsWith("91")) ten = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) ten = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return ten;
}

export function parseSchoolClass(value: string): number | null {
  const match = String(value).match(/(\d{1,2})/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

export function formatClassLabel(value: string | null | undefined): string {
  const n = parseSchoolClass(String(value ?? ""));
  if (n) return `Class ${n}`;
  const trimmed = String(value ?? "").trim().replace(/^class\s+/i, "");
  return trimmed || "—";
}
