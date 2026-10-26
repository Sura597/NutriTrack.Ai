import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser, asUser } from "../helpers/db";

const items = [
  { food_name: "Roti / chapati (plain)", quantity: 2, unit: "piece", calories_kcal: 204, protein_g: 6.6, carbs_g: 41.4, fat_g: 1, fiber_g: 6.6, estimation_source: "database", assumptions: ["no oil"] },
  { food_name: "Dal tadka", quantity: 150, unit: "g", calories_kcal: 187, protein_g: 9, carbs_g: 22, fat_g: 7, estimation_source: "database" },
];

describe("create_food_log / update_food_log / search_foods", () => {
  let db: PGlite;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "Bob");
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const create = (uid: string, its: unknown = items) =>
    asUser(db, uid, async () => {
      const r = await db.query<{ id: string }>(
        `select public.create_food_log($1::timestamptz, 'lunch', 'text', 'rotis and dal', null, null, $2::jsonb) as id`,
        ["2026-03-10T07:00:00Z", JSON.stringify(its)],
      );
      return r.rows[0].id;
    });

  it("creates a log with all its items in one call", async () => {
    const id = await create(alice);
    const r = await asUser(db, alice, () =>
      db.query<{ n: number; kcal: string }>(
        `select count(*)::int as n, sum(calories_kcal)::text as kcal from public.food_log_items where food_log_id = $1`, [id]),
    );
    expect(r.rows[0].n).toBe(2);
    expect(Number(r.rows[0].kcal)).toBe(391);
    const a = await asUser(db, alice, () => db.query<{ assumptions: string[] }>(`select assumptions from public.food_log_items where food_log_id = $1 and food_name like 'Roti%'`, [id]));
    expect(a.rows[0].assumptions).toEqual(["no oil"]);
  });

  it("rolls back the whole log if any item violates a constraint", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from public.food_logs");
    await expect(create(alice, [items[0], { ...items[1], calories_kcal: -5 }])).rejects.toThrow();
    const after = await db.query<{ n: number }>("select count(*)::int as n from public.food_logs");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("requires at least one item", async () => {
    await expect(create(alice, [])).rejects.toThrow(/at least one item/);
  });

  it("is not callable without a signed-in user", async () => {
    await expect(
      db.query(`select public.create_food_log(now(), 'lunch', 'text', null, null, null, $1::jsonb)`, [JSON.stringify(items)]),
    ).rejects.toThrow(/not authenticated/);
  });

  it("updates meal type, notes and replaces items", async () => {
    const id = await create(alice);
    await asUser(db, alice, () =>
      db.query(`select public.update_food_log($1, null, 'dinner', true, 'ate late', $2::jsonb)`, [
        id,
        JSON.stringify([{ ...items[0], quantity: 3, calories_kcal: 306 }]),
      ]),
    );
    const log = await asUser(db, alice, () => db.query<{ meal_type: string; notes: string }>(`select meal_type, notes from public.food_logs where id = $1`, [id]));
    expect(log.rows[0]).toEqual({ meal_type: "dinner", notes: "ate late" });
    const its = await asUser(db, alice, () => db.query<{ calories_kcal: string }>(`select calories_kcal from public.food_log_items where food_log_id = $1`, [id]));
    expect(its.rows).toHaveLength(1);
    expect(Number(its.rows[0].calories_kcal)).toBe(306);
  });

  it("leaves notes and items untouched when not provided", async () => {
    const id = await create(alice);
    await asUser(db, alice, () => db.query(`select public.update_food_log($1, null, 'snack', false, null, null)`, [id]));
    const n = await asUser(db, alice, () => db.query<{ n: number }>(`select count(*)::int as n from public.food_log_items where food_log_id = $1`, [id]));
    expect(n.rows[0].n).toBe(2);
  });

  it("cannot update another user's log", async () => {
    const id = await create(alice);
    await expect(
      asUser(db, bob, () => db.query(`select public.update_food_log($1, null, 'dinner', false, null, null)`, [id])),
    ).rejects.toThrow(/log not found/);
    const still = await db.query<{ meal_type: string }>(`select meal_type from public.food_logs where id = $1`, [id]);
    expect(still.rows[0].meal_type).toBe("lunch");
  });

  it("deleting a log removes its items", async () => {
    const id = await create(alice);
    await asUser(db, alice, () => db.query(`delete from public.food_logs where id = $1`, [id]));
    const n = await db.query<{ n: number }>(`select count(*)::int as n from public.food_log_items where food_log_id = $1`, [id]);
    expect(n.rows[0].n).toBe(0);
  });

  it("finds foods by name, alias and typo", async () => {
    const names = (q: string) =>
      asUser(db, alice, async () => (await db.query<{ food_name: string }>(`select food_name from public.search_foods($1, 5)`, [q])).rows.map((r) => r.food_name));
    expect((await names("roti"))[0]).toMatch(/Roti/);
    expect((await names("chapati"))[0]).toMatch(/Roti/);
    expect(await names("paneer")).toContain("Paneer");
    expect((await names("dahi"))[0]).toMatch(/Curd/);
    expect(await names("panner")).toContain("Paneer"); // fuzzy
    expect(await names("")).toEqual([]);
    expect(await names("%")).toEqual([]); // wildcards are stripped, not interpreted
  });
});
