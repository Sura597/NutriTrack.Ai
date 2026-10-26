"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Leaf, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Notice, Skeleton } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Recommendation, RecommendationFilter } from "@/lib/recommendations/engine";

interface Context {
  remaining_kcal: number | null;
  daily_budget_inr: number | null;
  estimated_spend_today_inr: number;
  remaining_budget_inr: number | null;
  unpriced_items_today: number;
  price_adjustment_pct: number;
}
interface Payload {
  recommendations: Recommendation[];
  context: Context;
  disclaimer: string;
}

const FILTERS: { id: RecommendationFilter; label: string }[] = [
  { id: "cheapest_protein", label: "Cheapest protein" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "high_protein", label: "High protein" },
  { id: "fits_calories", label: "Fits my calories" },
  { id: "fits_budget", label: "Fits my budget" },
];

export function FoodsExplorer({ initialAdjustment }: { initialAdjustment: number }) {
  const [active, setActive] = useState<RecommendationFilter[]>([]);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adj, setAdj] = useState(String(initialAdjustment));
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = active.length ? `?filters=${active.join(",")}` : "";
    fetch(`/api/recommendations/affordable-foods${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? "Couldn't load recommendations.");
        setData(j.data);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [active, version]);

  const toggle = (id: RecommendationFilter) => {
    setLoading(true);
    setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const saveAdjustment = useCallback(async () => {
    const n = Number(adj);
    if (!Number.isFinite(n) || n < -50 || n > 200) {
      toast.error("Enter a percentage between -50 and 200.");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_adjustment_pct: n }),
    });
    setSaving(false);
    if (!r.ok) {
      toast.error("Couldn't save the price adjustment.");
      return;
    }
    toast.success("Prices updated.");
    setLoading(true);
    setVersion((v) => v + 1);
  }, [adj]);

  const ctx = data?.context;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        {FILTERS.map((f) => {
          const on = active.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(f.id)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {ctx && (
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Card><CardContent className="p-4">
            <p className="text-muted-foreground">Calories left today</p>
            <p className="text-lg font-semibold tabular-nums">{ctx.remaining_kcal === null ? "No target set" : `${Math.max(ctx.remaining_kcal, 0)} kcal`}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-muted-foreground">Budget left today</p>
            <p className="text-lg font-semibold tabular-nums">{ctx.remaining_budget_inr === null ? "No budget set" : formatINR(Math.max(ctx.remaining_budget_inr, 0))}</p>
            {ctx.daily_budget_inr !== null && (
              <p className="text-xs text-muted-foreground">
                of {formatINR(ctx.daily_budget_inr)}; about {formatINR(ctx.estimated_spend_today_inr)} spent
                {ctx.unpriced_items_today > 0 ? ` (${ctx.unpriced_items_today} logged item${ctx.unpriced_items_today === 1 ? "" : "s"} not priced)` : ""}
              </p>
            )}
          </CardContent></Card>
          <Card><CardContent className="flex flex-col gap-2 p-4">
            <label htmlFor="adj" className="text-muted-foreground">Local price adjustment (%)</label>
            <div className="flex gap-2">
              <Input id="adj" inputMode="decimal" value={adj} onChange={(e) => setAdj(e.target.value)} className="h-9" />
              <Button size="sm" variant="outline" onClick={saveAdjustment} disabled={saving}>Save</Button>
            </div>
          </CardContent></Card>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : data && data.recommendations.length === 0 ? (
        <Notice tone="info">No foods match these filters. Try removing one.</Notice>
      ) : (
        <ul className={cn("grid gap-3 md:grid-cols-2", loading && "opacity-60")}>
          {data?.recommendations.map((r) => (
            <li key={r.food_id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{r.food_name}</h3>
                      <p className="text-xs text-muted-foreground">{r.serving}</p>
                    </div>
                    <Badge tone="green" className="shrink-0">
                      <Wallet className="mr-1 size-3" aria-hidden />~{formatINR(r.cost_per_serving_inr, r.cost_per_serving_inr < 10)}
                    </Badge>
                  </div>
                  <p className="text-sm tabular-nums">
                    {r.calories_kcal} kcal · {r.protein_g} g protein · {r.carbs_g} g carbs · {r.fat_g} g fat
                  </p>
                  {r.cost_per_10g_protein_inr !== null && (
                    <p className="text-sm">About {formatINR(r.cost_per_10g_protein_inr, true)} per 10 g protein</p>
                  )}
                  <p className="text-sm text-muted-foreground">{r.why}</p>
                  {r.prep_tip && (
                    <p className="mt-auto flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Leaf className="mt-0.5 size-3 shrink-0" aria-hidden />{r.prep_tip}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{data?.disclaimer ?? "Prices are rough estimates and vary by city, season and shop."}</p>
    </div>
  );
}
