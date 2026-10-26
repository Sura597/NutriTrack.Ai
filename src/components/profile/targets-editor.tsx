"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import type { TargetsRow } from "@/lib/data/profile";
import type { NutritionTargets } from "@/lib/nutrition/targets";

const FIELDS = [
  ["calories_kcal", "Calories (kcal)"],
  ["protein_g", "Protein (g)"],
  ["carbs_g", "Carbohydrates (g)"],
  ["fat_g", "Fat (g)"],
  ["fiber_g", "Fibre (g)"],
] as const;

export function TargetsEditor({ targets, suggested }: { targets: TargetsRow | null; suggested: NutritionTargets }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, targets?.[k]?.toString() ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Record<string, number> = {};
    for (const [k, label] of FIELDS) {
      const n = Number(vals[k]);
      if (vals[k].trim() === "" || !Number.isFinite(n) || n < 0) return setError(`Enter a valid number for ${label}.`);
      body[k] = n;
    }
    start(async () => {
      const res = await fetch("/api/nutrition/targets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return setError(j?.error?.details?.[0]?.message ?? j?.error?.message ?? "Couldn't save targets.");
      }
      toast.success("Targets saved");
      router.refresh();
    });
  }

  function reset() {
    start(async () => {
      const res = await fetch("/api/nutrition/targets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset_to_suggested: true }) });
      if (!res.ok) {
        toast.error("Couldn't reset targets.");
        return;
      }
      const j = await res.json();
      setVals(Object.fromEntries(FIELDS.map(([k]) => [k, j.data.targets?.[k]?.toString() ?? ""])));
      toast.success("Reset to suggested values");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {targets?.is_custom ? <Badge tone="amber">Custom targets</Badge> : <Badge tone="green">Suggested</Badge>}
        {suggested.calories_kcal && <span className="text-muted-foreground">Suggested: {suggested.calories_kcal} kcal</span>}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map(([k, label]) => (
          <Field key={k} id={`t-${k}`} label={label}>
            <Input id={`t-${k}`} inputMode="decimal" value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
      {suggested.status === "ok" && suggested.notices[0] && <p className="text-xs text-muted-foreground">{suggested.notices[0]}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save targets"}</Button>
        <Button type="button" variant="outline" disabled={pending || suggested.status === "restricted"} onClick={reset}>Reset to suggested</Button>
      </div>
    </form>
  );
}
