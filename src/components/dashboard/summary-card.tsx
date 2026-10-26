import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Meter, Notice } from "@/components/ui/misc";
import { CalorieRing } from "./calorie-ring";
import type { DaySummary } from "@/lib/data/logs";

const MACROS = [
  { key: "protein_g", label: "Protein", color: "var(--protein)" },
  { key: "carbs_g", label: "Carbs", color: "var(--carbs)" },
  { key: "fat_g", label: "Fat", color: "var(--fat)" },
] as const;

export function SummaryCard({ summary }: { summary: DaySummary }) {
  const { totals, targets } = summary;
  const hasTarget = !!targets?.calories_kcal;

  return (
    <Card>
      <CardContent className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex flex-col items-center gap-3">
          {hasTarget ? (
            <CalorieRing consumed={totals.calories_kcal} target={targets!.calories_kcal!} />
          ) : (
            <div className="grid size-40 place-items-center rounded-full bg-muted text-center">
              <div>
                <div className="text-3xl font-semibold tabular-nums">{totals.calories_kcal.toLocaleString("en-IN")}</div>
                <div className="text-xs text-muted-foreground">kcal logged</div>
              </div>
            </div>
          )}
          {hasTarget && (
            <dl className="grid w-full grid-cols-3 gap-2 text-center text-xs">
              <div><dt className="text-muted-foreground">Target</dt><dd className="text-sm font-semibold tabular-nums">{Math.round(targets!.calories_kcal!)}</dd></div>
              <div><dt className="text-muted-foreground">Logged</dt><dd className="text-sm font-semibold tabular-nums">{totals.calories_kcal}</dd></div>
              <div><dt className="text-muted-foreground">Left</dt><dd className="text-sm font-semibold tabular-nums">{summary.remaining_kcal}</dd></div>
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {MACROS.map((m) => {
            const consumed = totals[m.key];
            const target = targets?.[m.key] ?? null;
            return (
              <div key={m.key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(consumed)} g{target ? ` / ${Math.round(target)} g` : ""}
                  </span>
                </div>
                <Meter value={consumed} max={target ?? Math.max(consumed, 1)} label={`${m.label} consumed`} color={m.color} />
              </div>
            );
          })}
          {hasTarget ? (
            <p className="text-xs text-muted-foreground">
              Remaining = daily target − logged calories. It can go below zero. That&apos;s a tracking number, not a judgment, and food logs are estimates.
            </p>
          ) : (
            <Notice tone="info">
              No calorie target is set, so we&apos;re showing your intake only.{" "}
              <Link className="font-medium underline" href="/profile">Review your targets</Link>.
            </Notice>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
