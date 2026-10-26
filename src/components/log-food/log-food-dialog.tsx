"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLogFood } from "@/components/app/log-food-context";
import { MEAL_TYPES, type MealType } from "@/lib/nutrition/aggregate";
import { defaultMealType, draftFromAnalysis, draftFromSaved, draftToPayload, type DraftItem } from "@/lib/draft";
import type { LogItemInput } from "@/lib/schemas";
import type { LogRow } from "@/lib/data/logs";
import { ReviewPanel } from "./review-panel";
import { InputTabs } from "./input-tabs";
import { AnalysisBanner } from "./analysis-banner";
import type { AnalysisMeta, AnalysisResponse } from "./analysis";

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export function LogFoodDialog({ today }: { today: string }) {
  const { state, close } = useLogFood();
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      <DialogContent aria-describedby="log-desc">
        {/* Keyed by session so every open starts from fresh state, with no effects needed. */}
        {state.open && (
          <LogForm key={state.session} today={today} date={state.date} log={state.log ?? null} mealType={state.mealType} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LogForm({
  today, date: initialDate, log, mealType: initialMeal, onClose,
}: {
  today: string; date?: string; log: LogRow | null; mealType?: MealType; onClose: () => void;
}) {
  const router = useRouter();
  const editing = log;
  const [items, setItems] = useState<DraftItem[]>(() => (editing ? editing.items.map(draftFromSaved) : []));
  const [mealType, setMealType] = useState<MealType>(() => editing?.meal_type ?? initialMeal ?? defaultMealType());
  const [date, setDate] = useState(initialDate ?? today);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [step, setStep] = useState<"input" | "review">(editing ? "review" : "input");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);

  // An uploaded photo that never gets saved with a meal is discarded when this form closes.
  const pendingImage = useRef<string | null>(null);
  const saved = useRef(false);
  useEffect(
    () => () => {
      const path = pendingImage.current;
      if (path && !saved.current) {
        void fetch("/api/food/images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }), keepalive: true }).catch(() => {});
      }
    },
    [],
  );

  function discardImage() {
    const path = pendingImage.current;
    pendingImage.current = null;
    if (path) void fetch("/api/food/images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }).catch(() => {});
  }

  function analysed(r: AnalysisResponse, m: AnalysisMeta) {
    discardImage(); // replace any earlier photo
    pendingImage.current = m.imagePath;
    setAnalysis(r);
    setMeta(m);
    setItems(r.items.map(draftFromAnalysis));
    setStep("review");
  }

  function backToInput() {
    discardImage();
    setAnalysis(null);
    setMeta(null);
    setItems([]);
    setError(null);
    setStep("input");
  }

  function save() {
    setError(null);
    if (items.length === 0) {
      setError("Add at least one food first.");
      return;
    }
    const payloads: LogItemInput[] = [];
    for (const d of items) {
      const r = draftToPayload(d);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      payloads.push(r.item);
    }
    start(async () => {
      const body = editing
        ? { meal_type: mealType, notes: notes.trim() || null, date, items: payloads }
        : {
            date,
            meal_type: mealType,
            input_method: meta?.method ?? "manual",
            original_input: meta?.originalInput ?? null,
            image_path: meta?.imagePath ?? null,
            notes: notes.trim() || null,
            items: payloads,
          };
      const res = await fetch(editing ? `/api/food/logs/${editing.id}` : "/api/food/logs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error?.details?.[0]?.message ?? j?.error?.message ?? "Couldn't save this meal. Please try again.");
        return;
      }
      saved.current = true;
      toast.success(editing ? "Meal updated" : "Meal saved");
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit meal" : "Log food"}</DialogTitle>
        <DialogDescription id="log-desc">
          {step === "input"
            ? "Snap it, type it or say it. Values are estimates and you'll review them before anything is saved."
            : "Values are estimates. Check the portions and adjust anything that looks off before saving."}
        </DialogDescription>
      </DialogHeader>

      {step === "input" ? (
        <InputTabs onDone={analysed} onSkip={() => setStep("review")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" htmlFor="log-meal">Meal</label>
              <Select id="log-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="log-date">Date</label>
              <Input id="log-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {analysis && <AnalysisBanner analysis={analysis} />}
          <ReviewPanel items={items} onChange={setItems} />

          <div>
            <label className="text-sm font-medium" htmlFor="log-notes">Notes (optional)</label>
            <Textarea id="log-notes" className="min-h-16" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-between gap-2">
            {editing ? <span /> : <Button type="button" variant="ghost" onClick={backToInput} disabled={pending}>Back</Button>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button type="button" onClick={save} disabled={pending || items.length === 0}>
                {pending ? "Saving…" : editing ? "Save changes" : "Save meal"}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
