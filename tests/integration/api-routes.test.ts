import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setAiProviderForTests, type AIProvider } from "@/lib/ai/provider";

// The server Supabase client is replaced so route handlers run for real (auth wrapper,
// Zod validation, upload checks) without a network. Database behaviour is covered by the
// PGlite integration tests.
let signedIn = false;
vi.mock("@/lib/supabase/server", () => {
  class SupabaseNotConfiguredError extends Error {}
  const chain: Record<string, unknown> = {};
  const q = new Proxy(chain, {
    get: (_t, prop) => (prop === "then" ? undefined : () => q),
  });
  return {
    SupabaseNotConfiguredError,
    createClient: async () => ({
      auth: {
        getUser: async () =>
          signedIn ? { data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null } : { data: { user: null }, error: { message: "no session" } },
      },
      from: () => q,
      rpc: async () => ({ data: [], error: null }),
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({}) }) },
    }),
  };
});

const ROUTES: Record<string, string[]> = {
  "profile": ["GET", "PATCH"],
  "account": ["DELETE"],
  "food/analyze-voice": ["POST"],
  "food/analyze-image": ["POST"],
  "food/images": ["DELETE"],
  "food/analyze-text": ["POST"],
  "food/search": ["GET"],
  "food/logs": ["GET", "POST"],
  "food/logs/[id]": ["GET", "PATCH", "DELETE"],
  "weight/history": ["GET"],
  "weight/logs": ["POST"],
  "weight/logs/[id]": ["DELETE"],
  "water/logs": ["POST"],
  "water/logs/[id]": ["DELETE"],
  "water/summary": ["GET"],
  "recommendations/affordable-foods": ["GET"],
  "nutrition/history": ["GET"],
  "nutrition/summary": ["GET"],
  "nutrition/targets": ["GET", "PATCH"],
};

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;
const modules = import.meta.glob("../../src/app/api/**/route.ts") as Record<string, () => Promise<Record<string, Handler>>>;
const load = async (route: string) => {
  const loader = modules[`../../src/app/api/${route}/route.ts`];
  if (!loader) throw new Error(`no route module for ${route}`);
  return loader();
};
const ctx = { params: Promise.resolve({ id: "00000000-0000-4000-8000-0000000000aa" }) };
const call = (h: Handler, method: string, body?: unknown, url = "http://localhost/api/x") =>
  h(new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) }), ctx);

beforeEach(() => {
  signedIn = false;
});
afterEach(() => setAiProviderForTests(undefined));

describe("authentication", () => {
  const cases = Object.entries(ROUTES).flatMap(([route, methods]) => methods.map((m) => [route, m] as const));
  it.each(cases)("%s %s returns 401 for signed-out requests", async (route, method) => {
    const mod = await load(route);
    const res = await call(mod[method], method, method === "GET" || method === "DELETE" ? undefined : {});
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  it("covers every route file in the repo", async () => {
    const found = Object.keys(modules).map((p) => p.replace("../../src/app/api/", "").replace("/route.ts", "")).sort();
    expect(found).toEqual(Object.keys(ROUTES).sort());
  });
});

describe("request validation (signed in)", () => {
  beforeEach(() => {
    signedIn = true;
  });
  const bad: [string, string, unknown][] = [
    ["food/analyze-text", "POST", { text: "" }],
    ["food/analyze-text", "POST", { text: "x".repeat(1001) }],
    ["food/analyze-text", "POST", { nope: 1 }],
    ["weight/logs", "POST", { weight_kg: 5 }],
    ["weight/logs", "POST", { weight_kg: "heavy" }],
    ["water/logs", "POST", { amount_ml: 5 }],
    ["water/logs", "POST", { amount_ml: 5000 }],
    ["water/logs", "POST", { amount_ml: 250.5 }],
    ["water/logs", "POST", { amount_ml: "a glass" }],
    ["profile", "PATCH", { water_goal_ml: 100 }],
    ["weight/logs", "POST", { weight_kg: 70, measured_at: "yesterday" }],
    ["food/logs", "POST", { meal_type: "brunch", items: [] }],
    ["nutrition/targets", "PATCH", { calories_kcal: 50 }],
    ["profile", "PATCH", { height_cm: -3 }],
    ["profile", "PATCH", { price_adjustment_pct: 999 }],
  ];
  it.each(bad)("%s %s rejects %j with 400", async (route, method, body) => {
    const mod = await load(route);
    const res = await call(mod[method], method, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("rejects malformed JSON", async () => {
    const mod = await load("weight/logs");
    const res = await mod.POST(new Request("http://localhost/api/x", { method: "POST", body: "{not json", headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(400);
  });

  it("rejects future-dated weight entries", async () => {
    const mod = await load("weight/logs");
    const res = await call(mod.POST, "POST", { weight_kg: 70, measured_at: new Date(Date.now() + 86_400_000).toISOString() });
    expect(res.status).toBe(400);
  });

  it("treats malformed ids as not found / invalid", async () => {
    const mod = await load("food/logs/[id]");
    const res = await mod.GET(new Request("http://localhost/api/x"), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(404);
    const wl = await load("water/logs/[id]");
    expect((await wl.DELETE(new Request("http://localhost/api/x", { method: "DELETE" }), { params: Promise.resolve({ id: "nope" }) })).status).toBe(400);
    const w = await load("weight/logs/[id]");
    const res2 = await w.DELETE(new Request("http://localhost/api/x", { method: "DELETE" }), { params: Promise.resolve({ id: "nope" }) });
    expect(res2.status).toBe(400);
  });

  it("validates query parameters", async () => {
    expect((await call((await load("nutrition/history")).GET, "GET", undefined, "http://localhost/api/x?range=year")).status).toBe(400);
    expect((await call((await load("nutrition/summary")).GET, "GET", undefined, "http://localhost/api/x?date=2026-13-45")).status).toBe(400);
    expect((await call((await load("water/summary")).GET, "GET", undefined, "http://localhost/api/x?date=nope")).status).toBe(400);
    expect((await call((await load("food/search")).GET, "GET", undefined, "http://localhost/api/x")).status).toBe(400);
    expect((await call((await load("recommendations/affordable-foods")).GET, "GET", undefined, "http://localhost/api/x?filters=bogus")).status).toBe(400);
  });
});

describe("image upload checks", () => {
  beforeEach(() => {
    signedIn = true;
  });
  const provider: AIProvider = { name: "test", model: "t", supportsVision: true, isDemo: false, completeJson: async () => ({}) };
  const post = async (form: FormData) => (await load("food/analyze-image")).POST(new Request("http://localhost/api/food/analyze-image", { method: "POST", body: form }), ctx);

  it("returns 503 when no vision-capable AI is configured", async () => {
    setAiProviderForTests(null);
    const res = await post(new FormData());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_not_configured");
  });
  it("requires an image field", async () => {
    setAiProviderForTests(provider);
    expect((await post(new FormData())).status).toBe(400);
  });
  it("rejects empty files", async () => {
    setAiProviderForTests(provider);
    const f = new FormData();
    f.set("image", new File([], "a.jpg", { type: "image/jpeg" }));
    expect((await post(f)).status).toBe(400);
  });
  it("rejects files that claim to be images but aren't (magic bytes)", async () => {
    setAiProviderForTests(provider);
    const f = new FormData();
    f.set("image", new File([new TextEncoder().encode("<html>not an image</html>")], "a.jpg", { type: "image/jpeg" }));
    const res = await post(f);
    expect(res.status).toBe(415);
  });
  it("rejects oversized files", async () => {
    setAiProviderForTests(provider);
    vi.stubEnv("MAX_UPLOAD_MB", "1");
    const big = new Uint8Array(1024 * 1024 + 10);
    big.set([0xff, 0xd8, 0xff, 0xe0]);
    const f = new FormData();
    f.set("image", new File([big], "a.jpg", { type: "image/jpeg" }));
    const res = await post(f);
    vi.unstubAllEnvs();
    expect(res.status).toBe(413);
  });
});
