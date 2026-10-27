"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ALLERGEN_OPTIONS, COOKING_OPTIONS, profileSchema } from "@/lib/schemas";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";
import type { ProfileRow } from "@/lib/data/profile";

type Mode = "onboarding" | "edit";

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "Gluten (wheat)", dairy: "Milk / dairy", egg: "Egg", peanut: "Peanut",
  tree_nut: "Tree nuts", soy: "Soy", fish: "Fish", shellfish: "Shellfish",
};
const COOKING_LABELS: Record<string, string> = {
  stove: "Gas / induction stove", pressure_cooker: "Pressure cooker", microwave: "Microwave",
  kettle_only: "Only an electric kettle", no_cooking: "No cooking (hostel / travelling)",
};

interface FormState {
  display_name: string; date_of_birth: string; sex: string; height_cm: string; current_weight_kg: string;
  target_weight_kg: string; activity_level: string; goal: string; dietary_preference: string;
  allergies: string[]; restrictions: string; daily_budget_inr: string; water_goal_ml: string; food_preferences: string;
  cooking_facilities: string[]; pregnant_or_breastfeeding: boolean; has_medical_condition: boolean;
  eating_disorder_history: boolean;
}

function initial(p: ProfileRow | null): FormState {
  return {
    display_name: p?.display_name ?? "",
    date_of_birth: p?.date_of_birth ?? "",
    sex: p?.sex ?? "",
    height_cm: p?.height_cm?.toString() ?? "",
    current_weight_kg: p?.current_weight_kg?.toString() ?? "",
    target_weight_kg: p?.target_weight_kg?.toString() ?? "",
    activity_level: p?.activity_level ?? "light",
    goal: p?.goal ?? "maintain",
    dietary_preference: p?.dietary_preference ?? "vegetarian",
    allergies: p?.allergies ?? [],
    restrictions: (p?.dietary_restrictions ?? []).join(", "),
    daily_budget_inr: p?.daily_budget_inr?.toString() ?? "",
    water_goal_ml: String(p?.water_goal_ml ?? 2500),
    food_preferences: p?.food_preferences ?? "",
    cooking_facilities: p?.cooking_facilities ?? [],
    pregnant_or_breastfeeding: p?.pregnant_or_breastfeeding ?? false,
    has_medical_condition: p?.has_medical_condition ?? false,
    eating_disorder_history: p?.eating_disorder_history ?? false,
  };
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

const STEPS = ["About you", "Activity & goal", "Food & budget", "Health notes"] as const;
// Which fields live on which step, so we can jump back to the first step with an error.
const STEP_FIELDS: string[][] = [
  ["display_name", "date_of_birth", "sex", "height_cm", "current_weight_kg", "target_weight_kg"],
  ["activity_level", "goal"],
  ["dietary_preference", "allergies", "dietary_restrictions", "daily_budget_inr", "water_goal_ml", "food_preferences", "cooking_facilities"],
  ["pregnant_or_breastfeeding", "has_medical_condition", "eating_disorder_history"],
];

export function ProfileForm({ mode, profile, timeZoneInitial }: { mode: Mode; profile: ProfileRow | null; timeZoneInitial?: string }) {
  const router = useRouter();
  const [s, setS] = useState<FormState>(() => initial(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const toggle = (k: "allergies" | "cooking_facilities", v: string) =>
    set(k, s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v]);

  function buildPayload() {
    return {
      display_name: s.display_name,
      date_of_birth: s.date_of_birth,
      sex: s.sex === "" ? null : s.sex,
      height_cm: numOrNull(s.height_cm),
      current_weight_kg: numOrNull(s.current_weight_kg),
      target_weight_kg: numOrNull(s.target_weight_kg),
      activity_level: s.activity_level,
      goal: s.goal,
      dietary_preference: s.dietary_preference,
      allergies: s.allergies,
      dietary_restrictions: s.restrictions.split(",").map((x) => x.trim()).filter(Boolean),
      daily_budget_inr: numOrNull(s.daily_budget_inr),
      water_goal_ml: numOrNull(s.water_goal_ml) ?? 2500,
      food_preferences: s.food_preferences.trim() === "" ? null : s.food_preferences,
      cooking_facilities: s.cooking_facilities,
      pregnant_or_breastfeeding: s.pregnant_or_breastfeeding,
      has_medical_condition: s.has_medical_condition,
      eating_disorder_history: s.eating_disorder_history,
    };
  }

  function validate(): Record<string, string> {
    const parsed = profileSchema.safeParse(buildPayload());
    if (parsed.success) return {};
    const out: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!out[key]) out[key] = issue.message.includes("expected number") ? "Enter a number" : issue.message;
    }
    return out;
  }

  function next() {
    const errs = validate();
    const stepErrs = Object.fromEntries(Object.entries(errs).filter(([k]) => STEP_FIELDS[step].includes(k)));
    setErrors(stepErrs);
    if (Object.keys(stepErrs).length === 0) setStep((x) => Math.min(x + 1, STEPS.length - 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (mode === "onboarding") {
        const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]));
        if (first >= 0) setStep(first);
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }
    start(async () => {
      const body: Record<string, unknown> = { ...buildPayload(), time_zone: timeZoneInitial ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE) };
      if (mode === "onboarding") body.onboarding_completed = true;
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setServerError(j?.error?.message ?? "Couldn't save your profile. Please try again.");
        return;
      }
      if (mode === "onboarding") {
        router.replace("/dashboard");
        router.refresh();
      } else {
        toast.success("Profile saved");
        router.refresh();
      }
    });
  }

  const show = (i: number) => mode === "edit" || step === i;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {mode === "onboarding" && (
        <nav aria-label="Progress" className="flex items-center gap-2 text-sm">
          <span className="font-medium">Step {step + 1} of {STEPS.length}</span>
          <span className="text-muted-foreground">· {STEPS[step]}</span>
          <div className="ml-auto flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </nav>
      )}
      {serverError && <Notice tone="error">{serverError}</Notice>}

      {show(0) && (
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>We use this only to estimate your daily energy needs. You can change it any time.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name" error={errors.display_name} className="sm:col-span-2">
              <Input id="p-name" autoComplete="name" value={s.display_name} onChange={(e) => set("display_name", e.target.value)} aria-invalid={!!errors.display_name} />
            </Field>
            <Field id="p-dob" label="Date of birth" hint="We store your date of birth to work out your age, nothing else." error={errors.date_of_birth}>
              <Input id="p-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={s.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} aria-invalid={!!errors.date_of_birth} />
            </Field>
            <Field id="p-sex" label="Sex used in the calorie equation" hint="The standard equation has different constants for males and females. Skip it and we use a neutral midpoint." error={errors.sex}>
              <Select id="p-sex" value={s.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">Skip / prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            </Field>
            <Field id="p-height" label="Height (cm)" error={errors.height_cm}>
              <Input id="p-height" inputMode="decimal" value={s.height_cm} onChange={(e) => set("height_cm", e.target.value)} aria-invalid={!!errors.height_cm} />
            </Field>
            <Field id="p-weight" label="Current weight (kg)" error={errors.current_weight_kg}>
              <Input id="p-weight" inputMode="decimal" value={s.current_weight_kg} onChange={(e) => set("current_weight_kg", e.target.value)} aria-invalid={!!errors.current_weight_kg} />
            </Field>
            <Field id="p-target" label="Target weight (kg), optional" error={errors.target_weight_kg}>
              <Input id="p-target" inputMode="decimal" value={s.target_weight_kg} onChange={(e) => set("target_weight_kg", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      )}

      {show(1) && (
        <Card>
          <CardHeader>
            <CardTitle>Activity and goal</CardTitle>
            <CardDescription>Your activity level scales your daily energy estimate. Goals only nudge it gently.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="p-activity" label="Activity level">
              <Select id="p-activity" value={s.activity_level} onChange={(e) => set("activity_level", e.target.value)}>
                <option value="sedentary">Sedentary: desk work, little exercise</option>
                <option value="light">Lightly active: light exercise 1-3 days/week</option>
                <option value="moderate">Moderately active: exercise 3-5 days/week</option>
                <option value="very_active">Very active: hard exercise 6-7 days/week</option>
              </Select>
            </Field>
            <Field id="p-goal" label="Goal">
              <Select id="p-goal" value={s.goal} onChange={(e) => set("goal", e.target.value)}>
                <option value="lose">Lose weight gradually</option>
                <option value="maintain">Maintain weight</option>
                <option value="gain">Gain weight gradually</option>
              </Select>
            </Field>
            <Notice className="sm:col-span-2">
              We never suggest aggressive deficits or surpluses, and we don&apos;t set weight-loss targets for anyone under 18.
            </Notice>
          </CardContent>
        </Card>
      )}

      {show(2) && (
        <Card>
          <CardHeader>
            <CardTitle>Food and budget</CardTitle>
            <CardDescription>Used to suggest affordable foods that suit you. Allergies are never overridden by suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="p-diet" label="Dietary preference">
              <Select id="p-diet" value={s.dietary_preference} onChange={(e) => set("dietary_preference", e.target.value)}>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian (vegetarian + eggs)</option>
                <option value="non_vegetarian">Non-vegetarian</option>
              </Select>
            </Field>
            <Field id="p-budget" label="Daily food budget (₹)" hint="Optional. Helps us suggest foods that fit." error={errors.daily_budget_inr}>
              <Input id="p-budget" inputMode="decimal" placeholder="e.g. 150" value={s.daily_budget_inr} onChange={(e) => set("daily_budget_inr", e.target.value)} />
            </Field>
            <Field id="p-water" label="Daily water goal (ml)" hint="A general starting point is 2500 ml. Needs vary; ask your doctor if you have fluid limits." error={errors.water_goal_ml}>
              <Input id="p-water" inputMode="numeric" value={s.water_goal_ml} onChange={(e) => set("water_goal_ml", e.target.value)} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Food allergies</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ALLERGEN_OPTIONS.map((a) => (
                  <label key={a} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.allergies.includes(a)} onChange={() => toggle("allergies", a)} />
                    {ALLERGEN_LABELS[a]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="p-restrictions" label="Other restrictions" hint="Comma-separated, e.g. no onion-garlic, jain, no beef" className="sm:col-span-2" error={errors.dietary_restrictions}>
              <Input id="p-restrictions" value={s.restrictions} onChange={(e) => set("restrictions", e.target.value)} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Cooking facilities</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {COOKING_OPTIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.cooking_facilities.includes(c)} onChange={() => toggle("cooking_facilities", c)} />
                    {COOKING_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="p-prefs" label="Foods you usually eat or enjoy" hint="Optional, e.g. South Indian breakfasts, rajma-chawal, eggs" className="sm:col-span-2" error={errors.food_preferences}>
              <Textarea id="p-prefs" maxLength={500} value={s.food_preferences} onChange={(e) => set("food_preferences", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      )}

      {show(3) && (
        <Card>
          <CardHeader>
            <CardTitle>Health notes</CardTitle>
            <CardDescription>
              Optional. If any of these apply, we won&apos;t give calorie targets, because they need a plan from a doctor or dietitian.
              This is never sent to the AI service.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(
              [
                ["pregnant_or_breastfeeding", "I am pregnant or breastfeeding"],
                ["has_medical_condition", "I have a medical condition that affects what I should eat (e.g. diabetes, kidney disease)"],
                ["eating_disorder_history", "I have a history of an eating disorder"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={s[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "onboarding" ? (
        <div className="flex justify-between gap-3">
          <Button type="button" variant="outline" disabled={step === 0 || pending} onClick={() => setStep((x) => Math.max(0, x - 1))}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>Continue</Button>
          ) : (
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Finish setup"}</Button>
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        </div>
      )}
    </form>
  );
}
