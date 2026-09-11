import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-ink-700 text-cream-50 hover:bg-ink-800",
    secondary: "border border-cream-200/20 bg-ink-800 text-cream-100 hover:border-cream-200/40",
    ghost: "text-cream-100 hover:bg-ink-800",
    danger: "bg-temple-red text-cream-50 hover:brightness-110",
  } as const;
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("surface-card p-6", className)}>{children}</div>;
}

export { PasswordInput } from "./password-input";
export { PhotoSlider } from "./photo-slider";
export { ClassSelect } from "./class-select";
export { OrgLogo } from "./org-logo";
export { parseLang, LANG_COOKIE, type Lang } from "./i18n/lang";
export { t, copy, type CopyKey } from "./i18n/copy";
export { LangProvider, useLang, useT } from "./i18n/provider";
export { LanguageSwitcher } from "./i18n/LanguageSwitcher";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full min-h-11 rounded-xl border border-gold-500/20 bg-ink-950/60 px-3.5 py-2.5 text-base text-cream-50 outline-none ring-gold-400/40 placeholder:text-cream-200/40 focus:ring-2 sm:text-sm",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full min-h-32 rounded-xl border border-gold-500/20 bg-ink-950/60 px-3.5 py-2.5 text-cream-50 outline-none ring-gold-400/40 placeholder:text-cream-200/40 focus:ring-2",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-cream-200/70">
      {children}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "warn" | "danger";
}) {
  const tones = {
    neutral: "border-cream-200/20 text-cream-200",
    gold: "border-cream-200/25 text-cream-100",
    success: "border-emerald-400/40 text-emerald-300",
    warn: "border-amber-400/40 text-amber-200",
    danger: "border-red-400/40 text-red-300",
  } as const;
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "PENDING" ? "warn" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-8">
      {kicker ? <p className="mb-2 text-xs uppercase tracking-[0.28em] text-cream-200/70">{kicker}</p> : null}
      <h1 className="font-display text-3xl text-cream-50 sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-cream-200/80">{subtitle}</p> : null}
    </header>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <h2 className="font-display text-2xl text-cream-50">{title}</h2>
      <p className="mt-2 text-cream-200/70">{body}</p>
    </Card>
  );
}

export function Alert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  const tones = {
    info: "border-cream-200/20 bg-ink-800/80 text-cream-100",
    success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    error: "border-red-400/30 bg-red-400/10 text-red-100",
  } as const;
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.2em] text-cream-200/70">{label}</p>
      <p className="mt-2 font-display text-3xl text-cream-50">{value}</p>
    </Card>
  );
}

export function Spinner() {
  return (
    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-400" />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-sm text-cream-200/80">{label}</p>
      </div>
    </div>
  );
}
