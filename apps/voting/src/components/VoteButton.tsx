"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  projectId: string;
  projectName: string;
  signedIn: boolean;
  alreadyVoted: boolean;
  votedProjectName?: string | null;
};

export function VoteButton({ projectId, projectName, signedIn, alreadyVoted, votedProjectName }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [widgetReady, setWidgetReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileId = useMemo(() => `cf-turnstile-${projectId.slice(0, 8)}`, [projectId]);

  async function startVote() {
    setMessage(null);
    if (!signedIn) {
      const next = `/projects/${projectId}?vote=1`;
      const supabase = supabaseBrowser();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      return;
    }
    if (alreadyVoted) {
      setTone("error");
      setMessage(t("alreadyVoted"));
      return;
    }
    setOpen(true);
    if (siteKey) setTimeout(() => setWidgetReady(true), 50);
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    let token = "";
    if (siteKey) {
      const input = document.querySelector<HTMLInputElement>(`#${turnstileId} [name="cf-turnstile-response"]`);
      token = input?.value || "";
      if (!token) {
        setBusy(false);
        setTone("error");
        setMessage(t("turnstile"));
        return;
      }
    }

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, turnstile_token: token }),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string; message?: string };
    setBusy(false);
    if (data.ok) {
      setOpen(false);
      setTone("success");
      setMessage(t("voteOk"));
      router.refresh();
      return;
    }
    setTone("error");
    setMessage(data.code === "already_voted" ? t("alreadyVoted") : data.message || t("voteFail"));
  }

  return (
    <div className="space-y-3">
      <Button onClick={startVote} disabled={busy} className="w-full sm:w-auto">
        {t("vote")}
      </Button>
      {alreadyVoted && votedProjectName ? (
        <p className="text-sm text-cream-200/70">
          {t("alreadyVotedFor")} {votedProjectName}.
        </p>
      ) : null}
      {message ? <Alert tone={tone}>{message}</Alert> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4">
          <div className="surface-card w-full max-w-md p-5 sm:p-6">
            <h2 className="font-display text-2xl text-cream-50">{t("confirmVote")}</h2>
            <p className="mt-3 text-cream-100">
              {t("votingFor")}
              <br />
              <span className="font-semibold text-cream-50">{projectName}</span>
            </p>
            <p className="mt-3 text-sm text-cream-200/80">{t("voteSure")}</p>
            {siteKey ? (
              <div className="mt-4" id={turnstileId}>
                {widgetReady ? <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" /> : null}
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              </div>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                {t("cancel")}
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? t("submitting") : t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
