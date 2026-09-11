export const LANG_COOKIE = "lang";
export type Lang = "bn" | "en";

export function parseLang(value: string | undefined | null): Lang {
  return value === "en" ? "en" : "bn";
}
