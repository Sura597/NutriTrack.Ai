"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WeightLog { id: string; measured_at: string; weight_kg: number; notes: string | null }

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function WeightPanel() {
  const [logs, setLogs] = useState<WeightLog[] | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/weight/history?days=180");
    if (!r.ok) {
      toast.error("Couldn't load weight history.");
      setLogs([]);
      return;
    }
    const j = await r.json();
    setLogs(j.data.logs);
    setChange(j.data.change_kg);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(value);
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      toast.error("Enter a weight between 20 and 400 kg.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/weight/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weight_kg: kg }) });
    setBusy(false);
    if (!r.ok) {
      toast.error("Couldn't save your weight.");
      return;
    }
    setValue("");
    toast.success("Weight saved.");
    void load();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/weight/logs/${id}`, { method: "DELETE" });
    if (!r.ok) return void toast.error("Couldn't delete that entry.");
    void load();
  }

  const data = (logs ?? []).map((l) => ({ t: l.measured_at, kg: l.weight_kg }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight</CardTitle>
        <CardDescription>Measured weight only. It is shown separately from your logged intake, and we don&apos;t infer body fat or fat loss from it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={add} className="flex gap-2">
          <Input inputMode="decimal" placeholder="Today's weight (kg)" aria-label="Weight in kilograms" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-48" />
          <Button type="submit" disabled={busy}>Add</Button>
        </form>
        {logs === null ? null : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No weight entries yet.</p>
        ) : (
          <>
            {change !== null && logs.length > 1 && (
              <p className="text-sm">Change over this period: <span className="font-medium tabular-nums">{change > 0 ? "+" : ""}{change} kg</span></p>
            )}
            {logs.length > 1 && (
              <div className="h-48" role="img" aria-label="Weight over time line chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="t" tickFormatter={fmt} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" minTickGap={24} />
                    <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickLine={false} axisLine={false} fontSize={12} width={44} stroke="var(--muted-foreground)" />
                    <Tooltip labelFormatter={(l) => fmt(String(l))} formatter={(v) => [`${v} kg`, "Weight"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 13 }} />
                    <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="divide-y divide-border text-sm">
              {[...logs].reverse().slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-1.5">
                  <span>{fmt(l.measured_at)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{l.weight_kg} kg</span>
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Delete entry from ${fmt(l.measured_at)}`} onClick={() => remove(l.id)}>
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
