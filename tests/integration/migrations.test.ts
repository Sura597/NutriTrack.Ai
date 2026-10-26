import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser } from "../helpers/db";

describe("migrations", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it("applies cleanly and seeds foods and prices", async () => {
    const foods = await db.query<{ n: number }>("select count(*)::int as n from public.food_database");
    const prices = await db.query<{ n: number }>("select count(*)::int as n from public.food_price_estimates");
    expect(foods.rows[0].n).toBeGreaterThanOrEqual(80);
    expect(prices.rows[0].n).toBeGreaterThan(40);
  });

  it("creates a profile and settings row for each new auth user", async () => {
    const id = await createUser(db, "Asha");
    const p = await db.query<{ display_name: string }>("select display_name from public.profiles where id = $1", [id]);
    const s = await db.query("select 1 from public.user_settings where user_id = $1", [id]);
    expect(p.rows[0].display_name).toBe("Asha");
    expect(s.rows).toHaveLength(1);
  });

  it("enables RLS on every user-owned table", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    for (const row of r.rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });
});
