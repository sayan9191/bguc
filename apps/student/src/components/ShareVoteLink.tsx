"use client";

import { useState } from "react";
import { useT } from "@exhibition/ui";

export function ShareVoteLink({
  url,
  projectName,
  approved,
}: {
  url: string;
  projectName: string;
  approved: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const message = `${t("shareText")} "${projectName}": ${url}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t("shareVote")}</p>
      <p className="text-sm text-cream-200/80">{approved ? t("shareOk") : t("shareWait")}</p>
      <p className="break-all rounded-xl border border-gold-500/20 bg-ink-950 px-3 py-2 text-sm text-gold-200">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-700 px-5 text-sm font-semibold text-cream-50"
        >
          {copied ? t("copied") : t("copyLink")}
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-gold-500/30 px-5 text-sm text-gold-200"
        >
          {t("whatsapp")}
        </a>
      </div>
    </section>
  );
}
