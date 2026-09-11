"use client";

import { Badge, useT } from "@exhibition/ui";
import { formatClassLabel } from "@exhibition/database";

export function ProjectMeta({
  group,
  school,
  className,
  team,
  mentor,
}: {
  group?: string;
  school: string | null;
  className: string | null;
  team: string | null;
  mentor?: string | null;
}) {
  const t = useT();
  const groupLabel = group === "A" ? t("groupA") : group === "B" ? t("groupB") : "";
  const n = formatClassLabel(className).replace(/^Class\s+/i, "");
  return (
    <>
      {groupLabel ? <Badge tone="gold">{groupLabel}</Badge> : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-gold-400">{t("school")}</dt>
          <dd>{school}</dd>
        </div>
        <div>
          <dt className="text-gold-400">{t("classLabel")}</dt>
          <dd>{n === "—" ? "—" : n}</dd>
        </div>
        <div>
          <dt className="text-gold-400">{t("members")}</dt>
          <dd>{team}</dd>
        </div>
        <div>
          <dt className="text-gold-400">{t("mentor")}</dt>
          <dd>{mentor || "—"}</dd>
        </div>
      </dl>
    </>
  );
}

export function SectionTitle({ k }: { k: "members" | "gallery" }) {
  const t = useT();
  return <h2 className="mb-3 font-display text-2xl">{k === "members" ? t("teamMembers") : t("photos")}</h2>;
}
