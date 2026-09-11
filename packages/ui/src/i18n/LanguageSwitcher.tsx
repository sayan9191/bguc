"use client";

import { LANG_COOKIE, type Lang } from "./lang";
import { useLang } from "./provider";

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 3.8 6 3.8 9s-1.3 6-3.8 9c-2.5-3-3.8-6-3.8-9s1.3-6 3.8-9Z" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const lang = useLang();

  function setLang(next: Lang) {
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    window.location.reload();
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-cream-200/20 px-1.5 py-0.5"
      title={lang === "bn" ? "ভাষা · Language" : "Language · ভাষা"}
    >
      <span className="text-cream-200/70">
        <GlobeIcon />
      </span>
      <button
        type="button"
        onClick={() => setLang("bn")}
        aria-label="বাংলা"
        aria-pressed={lang === "bn"}
        className={`min-h-8 min-w-8 rounded-full text-[11px] font-semibold ${
          lang === "bn" ? "bg-ink-700 text-cream-50" : "text-cream-200/70"
        }`}
      >
        বাং
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-label="English"
        aria-pressed={lang === "en"}
        className={`min-h-8 min-w-8 rounded-full text-[11px] font-semibold ${
          lang === "en" ? "bg-ink-700 text-cream-50" : "text-cream-200/70"
        }`}
      >
        EN
      </button>
    </div>
  );
}
