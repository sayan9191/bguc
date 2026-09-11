"use client";

import { useState } from "react";
import type { ExhibitionSettings } from "@exhibition/database";
import { Alert, Button, Card, Input, Label } from "@exhibition/ui";
import { saveSettings } from "@/app/actions";

function toLocal(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

export function SettingsForm({ settings }: { settings: ExhibitionSettings }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(formData: FormData) {
    setError(null);
    setOk(false);
    const result = await saveSettings(formData);
    if (result?.error) setError(result.error);
    else setOk(true);
  }

  return (
    <Card>
      <form action={save} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {ok ? <Alert tone="success">Settings saved.</Alert> : null}
        <div>
          <Label>Exhibition name</Label>
          <Input name="exhibition_name" defaultValue={settings.exhibition_name} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="voting_enabled" defaultChecked={settings.voting_enabled} />
          Enable voting
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="results_visible" defaultChecked={settings.results_visible} />
          Show public results / leaderboard
        </label>
        <div>
          <Label>Voting start</Label>
          <Input type="datetime-local" name="voting_start" defaultValue={toLocal(settings.voting_start)} />
        </div>
        <div>
          <Label>Voting end</Label>
          <Input type="datetime-local" name="voting_end" defaultValue={toLocal(settings.voting_end)} />
        </div>
        <Button type="submit" className="w-full sm:w-auto">Save</Button>
      </form>
    </Card>
  );
}
