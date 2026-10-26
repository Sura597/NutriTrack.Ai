import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/misc";
import type { DaySummary } from "@/lib/data/logs";

const ROWS = [
  { key: "iron_mg", label: "Iron", unit: "mg" },
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { key: "vitamin_d_iu", label: "Vitamin D", unit: "IU" },
  { key: "vitamin_b12_mcg", label: "Vitamin B12", unit: "mcg" },
] as const;

export function MicronutrientsCard({ summary }: { summary: DaySummary }) {
  if (summary.item_count === 0) return null;
  const ref = (summary.targets?.micronutrients ?? {}) as Record<string, number>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vitamins and minerals</CardTitle>
        <CardDescription>
          Partial picture only. Values come from foods in our table that have data for them (most foods don&apos;t), so a low number does not mean you are low in a nutrient.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {ROWS.map((r) => {
          const m = summary.micronutrients[r.key];
          const target = ref[r.key];
          return (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {m ? `${m.total} ${r.unit}` : "No data"}
                  {target ? ` · reference ${target} ${r.unit}` : ""}
                </span>
              </div>
              {target ? <Meter value={m?.total ?? 0} max={target} label={`${r.label} from logged foods with data`} /> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {m ? `From ${m.items_with_data} of ${summary.item_count} logged items` : "None of today's logged items had this value"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
