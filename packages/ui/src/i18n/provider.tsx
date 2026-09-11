"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "./lang";
import { t, type CopyKey } from "./copy";

const LangContext = createContext<Lang>("bn");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT() {
  const lang = useLang();
  return (key: CopyKey) => t(lang, key);
}
