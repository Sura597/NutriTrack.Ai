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

describe("water tracking (migration 0008)", () => {
  let db: PGlite;
  let alice: string;
  let bob: string;
  const add = (uid: string, at: string, ml: number) =>
    asUser(db, uid, () => db.query(`insert into public.water_logs (user_id, consumed_at, amount_ml) values ($1, $2::timestamptz, $3)`, [uid, at, ml]));

  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "Bob");
    await add(alice, "2026-03-10T18:00:00Z", 500); // 23:30 IST, 10 Mar
    await add(alice, "2026-03-10T19:00:00Z", 250); // 00:30 IST, 11 Mar
    await add(alice, "2026-03-10T04:00:00Z", 300); // 09:30 IST, 10 Mar
    await add(bob, "2026-03-10T04:00:00Z", 1000);
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it("totals per local day and only for the caller", async () => {
    const rows = await asUser(db, alice, async () =>
      (await db.query<{ day: string; total_ml: string }>(`select day::text, total_ml::text from public.daily_water('2026-03-09Z', '2026-03-13Z', 'Asia/Kolkata')`)).rows,
    );
    expect(rows).toEqual([{ day: "2026-03-10", total_ml: "800" }, { day: "2026-03-11", total_ml: "250" }]);
  });
  it("hides other users' entries and blocks inserting for someone else", async () => {
    const seen = await asUser(db, bob, async () => (await db.query(`select * from public.water_logs`)).rows.length);
    expect(seen).toBe(1);
    await expect(asUser(db, bob, () => db.query(`insert into public.water_logs (user_id, amount_ml) values ($1, 200)`, [alice]))).rejects.toThrow();
  });
  it("rejects silly amounts and a goal outside 500–8000 ml", async () => {
    await expect(add(alice, "2026-03-10T04:00:00Z", 5)).rejects.toThrow();
    await expect(add(alice, "2026-03-10T04:00:00Z", 9000)).rejects.toThrow();
    await expect(asUser(db, alice, () => db.query(`update public.profiles set water_goal_ml = 100 where id = $1`, [alice]))).rejects.toThrow();
  });
  it("only the owner can delete an entry", async () => {
    const id = (await asUser(db, alice, async () => (await db.query<{ id: string }>(`select id from public.water_logs limit 1`)).rows[0].id));
    const del = await asUser(db, bob, () => db.query(`delete from public.water_logs where id = $1 returning id`, [id]));
    expect(del.rows).toHaveLength(0);
    const mine = await asUser(db, alice, () => db.query(`delete from public.water_logs where id = $1 returning id`, [id]));
    expect(mine.rows).toHaveLength(1);
  });
});
