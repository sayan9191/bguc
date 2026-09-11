"use client";

import Link from "next/link";
import { Badge, useT } from "@exhibition/ui";
import { formatClassLabel } from "@exhibition/database";

function descriptionPreview(text: string | null | undefined, maxWords = 22) {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { preview: "" };
  if (words.length <= maxWords) return { preview: words.join(" ") };
  return { preview: `${words.slice(0, maxWords).join(" ")}…` };
}

export function ProjectCard(props: {
  id: string;
  name: string;
  group?: string;
  school: string | null;
  className: string | null;
  team: string | null;
  description?: string | null;
  image?: string | null;
  voteCount?: number | null;
}) {
  const t = useT();
  const groupLabel = props.group === "A" ? t("groupA") : props.group === "B" ? t("groupB") : "";
  const detailsHref = `/projects/${props.id}`;
  const { preview } = descriptionPreview(props.description);
  const n = formatClassLabel(props.className).replace(/^Class\s+/i, "");
  const classLabel = n && n !== "—" ? `${t("classLabel")} ${n}` : t("classLabel");

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex min-h-[240px] items-center justify-center bg-ink-950 p-3 sm:min-h-[300px]">
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt={props.name} className="max-h-[300px] w-full object-contain" />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-gold-500/40">{t("noImage")}</div>
        )}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg leading-snug text-cream-50 sm:text-xl">{props.name}</h2>
          {groupLabel ? <Badge tone="gold">{groupLabel}</Badge> : null}
        </div>
        {preview ? (
          <p className="text-sm leading-relaxed text-cream-200/80">
            {preview}{" "}
            <Link href={detailsHref} className="font-semibold text-cream-50 hover:underline">
              {t("viewMore")}
            </Link>
          </p>
        ) : (
          <Link href={detailsHref} className="inline-block text-sm font-semibold text-cream-50 hover:underline">
            {t("viewMore")}
          </Link>
        )}
        <p className="text-sm text-cream-200/80">{props.school}</p>
        <p className="text-sm text-cream-200/60">{classLabel}</p>
        <p className="text-sm text-cream-100/90">{props.team}</p>
        {typeof props.voteCount === "number" ? (
          <p className="text-sm text-cream-100">
            {props.voteCount} {t("votesCount")}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={detailsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream-200/20 px-3 text-sm text-cream-100"
          >
            {t("view")}
          </Link>
          <Link
            href={`${detailsHref}?vote=1`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-700 px-3 text-sm font-semibold text-cream-50"
          >
            {t("vote")}
          </Link>
        </div>
      </div>
    </article>
  );
}
