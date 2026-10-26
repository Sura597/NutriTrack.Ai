import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { MicronutrientsCard } from "@/components/dashboard/micronutrients-card";
import { CalorieRing } from "@/components/dashboard/calorie-ring";
import type { DaySummary } from "@/lib/data/logs";
import type { TargetsRow } from "@/lib/data/profile";

const targets: TargetsRow = {
  user_id: "u", calories_kcal: 2000, protein_g: 70, carbs_g: 250, fat_g: 55, fiber_g: 28,
  micronutrients: { iron_mg: 19, calcium_mg: 1000 }, is_custom: false,
};
const emptyBy = { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
const summary = (over: Partial<DaySummary>): DaySummary => ({
  date: "2026-03-10",
  totals: { calories_kcal: 1500, protein_g: 50, carbs_g: 200, fat_g: 40, fiber_g: 10 },
  by_meal: { breakfast: emptyBy, lunch: emptyBy, dinner: emptyBy, snack: emptyBy },
  targets, remaining_kcal: 500, item_count: 2, meal_count: 1, micronutrients: {}, ...over,
});

describe("dashboard summary", () => {
  it("shows remaining calories under target", () => {
    const html = renderToStaticMarkup(<SummaryCard summary={summary({})} />);
    expect(html).toContain("500");
    expect(html).toContain("remaining");
    expect(html).toMatch(/tracking number, not a judgment/);
  });
  it("shows a negative remainder as 'over' without alarmist wording", () => {
    const html = renderToStaticMarkup(
      <SummaryCard summary={summary({ totals: { ...emptyBy, calories_kcal: 2300 }, remaining_kcal: -300 })} />,
    );
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).toContain("300");
    expect(text).toContain("over");
    expect(text).not.toMatch(/failed|bad|cheat|warning|exceeded/i);
  });
  it("shows intake only when there is no target", () => {
    const html = renderToStaticMarkup(<SummaryCard summary={summary({ targets: null, remaining_kcal: null })} />);
    expect(html).toMatch(/No calorie target is set/);
    expect(html).toContain("kcal logged");
  });
  it("exposes the ring to screen readers with the numbers", () => {
    const html = renderToStaticMarkup(<CalorieRing consumed={2300} target={2000} />);
    expect(html).toContain('aria-label="2300 of 2000 calories logged, 300 over target"');
  });
});

describe("micronutrient card honesty", () => {
  it("explains partial data and never implies a deficiency", () => {
    const html = renderToStaticMarkup(
      <MicronutrientsCard summary={summary({ micronutrients: { iron_mg: { total: 2.4, items_with_data: 1 } } })} />,
    );
    expect(html).toContain("From 1 of 2 logged items");
    expect(html).toContain("No data");
    expect(html).toMatch(/does not mean you are low/);
    expect(html).not.toMatch(/deficien/i);
  });
  it("renders nothing for an empty day", () => {
    expect(renderToStaticMarkup(<MicronutrientsCard summary={summary({ item_count: 0 })} />)).toBe("");
  });
});
