import type { SelectHTMLAttributes } from "react";

export function ClassSelect({
  className,
  emptyLabel = "Select class",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { emptyLabel?: string }) {
  return (
    <select
      {...props}
      className={[
        "min-h-11 w-full rounded-xl border border-gold-500/20 bg-ink-950/60 px-3.5 py-2.5 text-cream-50 outline-none ring-gold-400/40 focus:ring-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <option value="">{emptyLabel}</option>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
    </select>
  );
}
