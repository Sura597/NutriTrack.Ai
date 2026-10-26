import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser, asUser } from "../helpers/db";

describe("insight aggregation functions", () => {
  let db: PGlite;
  let alice: string;
  let bob: string;
  const mk = (uid: string, at: string, meal: string, kcal: number, name = "Roti") =>
    asUser(db, uid, async () => {
      await db.query(
        `select public.create_food_log($1::timestamptz, $2, 'text', null, null, null, $3::jsonb)`,
        [at, meal, JSON.stringify([{ food_name: name, quantity: 1, unit: "piece", calories_kcal: kcal, protein_g: 5, carbs_g: 20, fat_g: 2, estimation_source: "manual" }])],
      );
    });

  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "Bob");
    // 23:30 IST on 10 Mar (= 18:00Z) and 00:30 IST on 11 Mar (= 19:00Z) are different LOCAL days
    await mk(alice, "2026-03-10T18:00:00Z", "dinner", 300);
    await mk(alice, "2026-03-10T19:00:00Z", "snack", 100, "Chai");
    await mk(alice, "2026-03-10T04:00:00Z", "breakfast", 200);
    await mk(bob, "2026-03-10T04:00:00Z", "breakfast", 4000);
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const daily = (uid: string) =>
    asUser(db, uid, async () =>
      (await db.query<{ day: string; calories_kcal: string; meals: string }>(
        `select day::text, round(calories_kcal)::text as calories_kcal, meals::text from public.daily_nutrition('2026-03-09T00:00:00Z', '2026-03-13T00:00:00Z', 'Asia/Kolkata')`,
      )).rows,
    );

  it("groups by the user's local day and sums items", async () => {
    const rows = await daily(alice);
    expect(rows).toEqual([
      { day: "2026-03-10", calories_kcal: "500", meals: "2" },
      { day: "2026-03-11", calories_kcal: "100", meals: "1" },
    ]);
  });
  it("only ever aggregates the caller's own data", async () => {
    expect((await daily(bob))[0].calories_kcal).toBe("4000");
    const top = await asUser(db, bob, () => db.query(`select * from public.top_foods('2026-03-01Z', '2026-04-01Z', 5)`));
    expect(top.rows).toHaveLength(1);
  });
  it("ranks the most frequently logged foods and splits calories by meal", async () => {
    const top = await asUser(db, alice, () => db.query<{ food_name: string; times: string }>(`select food_name, times::text from public.top_foods('2026-03-01Z', '2026-04-01Z', 5)`));
    expect(top.rows[0]).toEqual({ food_name: "Roti", times: "2" });
    const split = await asUser(db, alice, () => db.query<{ meal_type: string; calories_kcal: string }>(`select meal_type, round(calories_kcal)::text as calories_kcal from public.meal_type_totals('2026-03-01Z', '2026-04-01Z') order by meal_type`));
    expect(split.rows).toEqual([
      { meal_type: "breakfast", calories_kcal: "200" },
      { meal_type: "dinner", calories_kcal: "300" },
      { meal_type: "snack", calories_kcal: "100" },
    ]);
  });
  it("returns nothing for signed-out callers", async () => {
    const r = await db.query(`select * from public.daily_nutrition('2026-03-01Z', '2026-04-01Z', 'UTC')`);
    expect(r.rows).toHaveLength(0);
  });
});
