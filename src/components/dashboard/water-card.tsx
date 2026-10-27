"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Droplets, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Entry { id: string; consumed_at: string; amount_ml: number }
const QUICK = [150, 250, 500];

const fmtMl = (ml: number) => (ml >= 1000 ? `${Math.round(ml / 100) / 10} L` : `${ml} ml`);

export function WaterCard({ entries, totalMl, goalMl, isToday, date, timeZone }: { entries: Entry[]; totalMl: number; goalMl: number; isToday: boolean; date: string; timeZone: string }) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, Math.round((totalMl / goalMl) * 100));

  async function add(ml: number) {
    if (!Number.isFinite(ml) || ml < 10 || ml > 3000) return void toast.error("Enter an amount between 10 and 3000 ml.");
    setBusy(true);
    // Past days: record at noon local time of that day so it lands on the right date.
    const body: Record<string, unknown> = { amount_ml: Math.round(ml) };
    if (!isToday) body.consumed_at = new Date(`${date}T12:00:00${offsetFor(timeZone, date)}`).toISOString();
    const r = await fetch("/api/water/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) return void toast.error("Couldn't save that. Please try again.");
    setCustom("");
    router.refresh();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/water/logs/${id}`, { method: "DELETE" });
    if (!r.ok) return void toast.error("Couldn't delete that entry.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Droplets className="size-4 text-protein" aria-hidden /> Water</CardTitle>
        <span className="text-sm tabular-nums text-muted-foreground">{fmtMl(totalMl)} of {fmtMl(goalMl)}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={goalMl} aria-valuenow={Math.min(totalMl, goalMl)} aria-label="Water intake today" className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-3 rounded-full bg-protein transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK.map((ml) => (
            <Button key={ml} size="sm" variant="soft" disabled={busy} onClick={() => add(ml)}><Plus /> {ml} ml</Button>
          ))}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(Number(custom)); }}>
            <Input inputMode="numeric" placeholder="Other (ml)" aria-label="Custom amount in millilitres" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 w-28" />
            <Button size="sm" variant="outline" type="submit" disabled={busy || !custom}>Add</Button>
          </form>
        </div>
        {entries.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {entries.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">{new Date(e.consumed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone })}</span>
                <span className="flex items-center gap-1">
                  <span className="tabular-nums">{e.amount_ml} ml</span>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Delete ${e.amount_ml} ml entry`} onClick={() => remove(e.id)}><Trash2 /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Your goal is a general target you can change in your profile. Needs vary with weather, activity and health; follow your doctor&apos;s advice if you have fluid limits.</p>
      </CardContent>
    </Card>
  );
}

/** "+05:30"-style offset of `tz` on `date`, so a local noon can be turned into an instant. */
function offsetFor(tz: string, date: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T12:00:00Z`));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}
