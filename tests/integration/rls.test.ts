import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser, asUser } from "../helpers/db";

describe("row level security", () => {
  let db: PGlite;
  let alice: string;
  let bob: string;
  let aliceLog: string;

  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "Bob");
    aliceLog = await asUser(db, alice, async () => {
      const log = await db.query<{ id: string }>(
        `insert into public.food_logs (user_id, meal_type, input_method) values ($1, 'lunch', 'text') returning id`,
        [alice],
      );
      await db.query(
        `insert into public.food_log_items (food_log_id, user_id, food_name, quantity, unit, calories_kcal, estimation_source)
         values ($1, $2, 'Roti', 2, 'piece', 204, 'database')`,
        [log.rows[0].id, alice],
      );
      await db.query(`insert into public.user_weight_logs (user_id, weight_kg) values ($1, 70)`, [alice]);
      return log.rows[0].id;
    });
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  it("lets a user read their own data", async () => {
    const r = await asUser(db, alice, () => db.query("select * from public.food_logs"));
    expect(r.rows).toHaveLength(1);
  });

  it("hides other users' logs, items, weights and profiles", async () => {
    await asUser(db, bob, async () => {
      expect((await db.query("select * from public.food_logs")).rows).toHaveLength(0);
      expect((await db.query("select * from public.food_log_items")).rows).toHaveLength(0);
      expect((await db.query("select * from public.user_weight_logs")).rows).toHaveLength(0);
      const profiles = await db.query<{ id: string }>("select id from public.profiles");
      expect(profiles.rows.map((p) => p.id)).toEqual([bob]);
    });
  });

  it("blocks updating or deleting another user's log (0 rows affected)", async () => {
    await asUser(db, bob, async () => {
      const upd = await db.query(`update public.food_logs set notes = 'hacked' where id = $1`, [aliceLog]);
      const del = await db.query(`delete from public.food_logs where id = $1`, [aliceLog]);
      expect(upd.affectedRows).toBe(0);
      expect(del.affectedRows).toBe(0);
    });
    const still = await db.query("select notes from public.food_logs where id = $1", [aliceLog]);
    expect(still.rows[0]).toEqual({ notes: null });
  });

  it("rejects inserting a log owned by someone else", async () => {
    await asUser(db, bob, async () => {
      await expect(
        db.query(`insert into public.food_logs (user_id, meal_type, input_method) values ($1, 'dinner', 'text')`, [alice]),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("rejects adding an item to another user's log (composite foreign key + RLS)", async () => {
    await asUser(db, bob, async () => {
      // claiming to be bob, attaching to alice's log: FK (log, user) has no match
      await expect(
        db.query(
          `insert into public.food_log_items (food_log_id, user_id, food_name, quantity, unit, calories_kcal, estimation_source)
           values ($1, $2, 'Sneaky', 1, 'piece', 10, 'manual')`,
          [aliceLog, bob],
        ),
      ).rejects.toThrow();
      // claiming to be alice: blocked by RLS
      await expect(
        db.query(
          `insert into public.food_log_items (food_log_id, user_id, food_name, quantity, unit, calories_kcal, estimation_source)
           values ($1, $2, 'Sneaky', 1, 'piece', 10, 'manual')`,
          [aliceLog, alice],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("makes food_database read-only for signed-in users", async () => {
    await asUser(db, bob, async () => {
      expect((await db.query("select 1 from public.food_database limit 1")).rows).toHaveLength(1);
      await expect(
        db.query(`update public.food_database set calories_kcal = 0`),
      ).resolves.toMatchObject({ affectedRows: 0 });
      await expect(
        db.query(`insert into public.food_database (food_name, normalized_name, category, dietary_type, serving_quantity, serving_unit, calories_kcal, protein_g, carbs_g, fat_g, source)
                  values ('x','x','x','vegan',1,'g',1,0,0,0,'x')`),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("enforces the rolling AI quota atomically per user", async () => {
    const results = await asUser(db, bob, async () => {
      const out: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const r = await db.query<{ ok: boolean }>(`select public.consume_ai_quota('analyze-text', 3) as ok`);
        out.push(r.rows[0].ok);
      }
      return out;
    });
    expect(results).toEqual([true, true, true, false]);
    // alice's quota is independent
    const a = await asUser(db, alice, () => db.query<{ ok: boolean }>(`select public.consume_ai_quota('analyze-text', 3) as ok`));
    expect(a.rows[0].ok).toBe(true);
  });

  it("does not let users write ai_usage directly", async () => {
    await asUser(db, bob, async () => {
      await expect(
        db.query(`insert into public.ai_usage (user_id, endpoint) values ($1, 'x')`, [bob]),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("scopes storage objects to the owner's folder", async () => {
    await asUser(db, alice, async () => {
      await db.query(`insert into storage.objects (bucket_id, name) values ('food-images', $1)`, [`${alice}/a.jpg`]);
      await expect(
        db.query(`insert into storage.objects (bucket_id, name) values ('food-images', $1)`, [`${bob}/evil.jpg`]),
      ).rejects.toThrow(/row-level security/i);
    });
    const seen = await asUser(db, bob, () => db.query("select name from storage.objects"));
    expect(seen.rows).toHaveLength(0);
  });

  it("cascades deletes from the auth user to all owned rows", async () => {
    const carol = await createUser(db, "Carol");
    await asUser(db, carol, async () => {
      const l = await db.query<{ id: string }>(
        `insert into public.food_logs (user_id, meal_type, input_method) values ($1,'snack','manual') returning id`, [carol]);
      await db.query(
        `insert into public.food_log_items (food_log_id, user_id, food_name, quantity, unit, calories_kcal, estimation_source)
         values ($1,$2,'Banana',1,'piece',89,'manual')`, [l.rows[0].id, carol]);
    });
    await db.query("delete from auth.users where id = $1", [carol]);
    for (const t of ["profiles:id", "user_settings:user_id", "food_logs:user_id", "food_log_items:user_id"]) {
      const [table, col] = t.split(":");
      const r = await db.query(`select 1 from public.${table} where ${col} = $1`, [carol]);
      expect(r.rows, table).toHaveLength(0);
    }
  });
});
