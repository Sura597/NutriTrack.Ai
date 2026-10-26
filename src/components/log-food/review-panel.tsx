"use client";

import { Trash2 } from "lucide-react";
import { Badge, Notice } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ALL_UNITS } from "@/lib/nutrition/units";
import { draftTotals, rescale, type DraftItem } from "@/lib/draft";
import { FoodSearch } from "./food-search";

const SOURCE_LABEL: Record<DraftItem["estimation_source"], { text: string; tone: "green" | "amber" | "neutral" }> = {
  database: { text: "Food table estimate", tone: "green" },
  ai: { text: "AI estimate", tone: "amber" },
  manual: { text: "Your numbers", tone: "neutral" },
};

export function ReviewPanel({ items, onChange }: { items: DraftItem[]; onChange: (items: DraftItem[]) => void }) {
  const update = (key: string, fn: (i: DraftItem) => DraftItem) => onChange(items.map((i) => (i.key === key ? fn(i) : i)));
  const totals = draftTotals(items);

  /** Editing a nutrient by hand turns the item into the user's own numbers. */
  const editNutrient = (key: string, field: "calories_kcal" | "protein_g" | "carbs_g" | "fat_g", value: string) =>
    update(key, (i) => {
      const next = { ...i, [field]: value, edited: true } as DraftItem;
      if (i.estimation_source !== "manual") {
        next.estimation_source = "manual";
        next.food_database_id = null;
        next.food = undefined;
        next.confidence = null;
        next.assumptions = [...i.assumptions, `Adjusted by you from the ${i.estimation_source === "ai" ? "AI" : "food table"} estimate`];
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <FoodSearch onAdd={(it) => onChange([...items, it])} />

      {items.length === 0 ? (
        <Notice>Add at least one food to save this meal.</Notice>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Foods in this meal">
          {items.map((it, idx) => {
            const src = SOURCE_LABEL[it.estimation_source];
            const uncertain = it.confidence !== null && it.confidence < 0.6;
            return (
              <li key={it.key} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`name-${it.key}`}>Food name {idx + 1}</label>
                    <Input id={`name-${it.key}`} value={it.food_name} onChange={(e) => update(it.key, (i) => ({ ...i, food_name: e.target.value }))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${it.food_name || "item"}`} onClick={() => onChange(items.filter((i) => i.key !== it.key))}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={src.tone}>{src.text}</Badge>
                  {it.confidence !== null && <Badge tone={uncertain ? "amber" : "neutral"}>{Math.round(it.confidence * 100)}% confident</Badge>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <div className="col-span-1 sm:col-span-1">
                    <label className="text-xs text-muted-foreground" htmlFor={`qty-${it.key}`}>Quantity</label>
                    <Input id={`qty-${it.key}`} inputMode="decimal" value={it.quantity} onChange={(e) => update(it.key, (i) => rescale(i, e.target.value, i.unit))} />
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <label className="text-xs text-muted-foreground" htmlFor={`unit-${it.key}`}>Unit</label>
                    <Select id={`unit-${it.key}`} value={it.unit} onChange={(e) => update(it.key, (i) => rescale(i, i.quantity, e.target.value))}>
                      {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </Select>
                  </div>
                  {(
                    [
                      ["calories_kcal", "kcal"],
                      ["protein_g", "Protein g"],
                      ["carbs_g", "Carbs g"],
                      ["fat_g", "Fat g"],
                    ] as const
                  ).map(([f, label]) => (
                    <div key={f}>
                      <label className="text-xs text-muted-foreground" htmlFor={`${f}-${it.key}`}>{label}</label>
                      <Input id={`${f}-${it.key}`} inputMode="decimal" value={it[f]} onChange={(e) => editNutrient(it.key, f, e.target.value)} />
                    </div>
                  ))}
                </div>

                {(it.assumptions.length > 0 || it.warnings.length > 0 || uncertain) && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {uncertain && <li className="font-medium text-warning">This estimate is uncertain, so please check the portion.</li>}
                    {it.warnings.map((w) => <li key={w} className="text-warning">{w}</li>)}
                    {it.assumptions.map((a) => <li key={a}>Assumed: {a}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm" aria-live="polite">
          <span className="font-semibold">Meal total: {Math.round(totals.kcal)} kcal</span>
          <span className="text-muted-foreground"> · P {Math.round(totals.p * 10) / 10} g · C {Math.round(totals.c * 10) / 10} g · F {Math.round(totals.f * 10) / 10} g</span>
        </div>
      )}
    </div>
  );
}
