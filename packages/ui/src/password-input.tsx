"use client";

import { useState, type InputHTMLAttributes } from "react";

export function PasswordInput({
  className,
  showLabel = "Show",
  hideLabel = "Hide",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { showLabel?: string; hideLabel?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        className={[
          "w-full min-h-11 rounded-xl border border-gold-500/20 bg-ink-950/60 px-3.5 py-2.5 pr-20 text-base text-cream-50 outline-none ring-gold-400/40 placeholder:text-cream-200/40 focus:ring-2 sm:text-sm",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-2 text-xs font-semibold uppercase tracking-wide text-gold-300 hover:bg-ink-800"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}
