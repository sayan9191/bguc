"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, PageHeader, PageLoader, PasswordInput, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError(t("passwordMin"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setBusy(false);
        setError(signInErr.message);
        return;
      }
    }
    router.push("/details");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      {busy ? <PageLoader label={t("creating")} /> : null}
      <PageHeader title={t("registerTitle")} subtitle={t("registerBody")} />
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <Label>{t("fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label>{t("email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>{t("password")}</Label>
            <PasswordInput
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              showLabel={t("show")}
              hideLabel={t("hide")}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("creating") : t("register")}
          </Button>
        </form>
        <p className="mt-4 text-sm">
          {t("alreadyRegistered")}{" "}
          <Link className="text-gold-300" href="/login">
            {t("signIn")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
