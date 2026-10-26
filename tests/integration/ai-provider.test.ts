import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { getAiProvider } from "@/lib/ai/provider";
import { aiConfig } from "@/lib/env";

type Handler = (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;

let server: http.Server;
let base = "";
let handler: Handler = (_r, _b, res) => res.end("{}");
let requests: { url: string; headers: http.IncomingHttpHeaders; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", headers: req.headers, body });
      handler(req, body, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const analysis = { items: [{ food_name: "Cooked rice", quantity: 150, unit: "g", calories_kcal: 195, protein_g: 4, carbs_g: 43, fat_g: 0.5 }] };
const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

function configure(provider: "anthropic" | "openai", extra: Record<string, string> = {}) {
  vi.stubEnv("AI_PROVIDER", provider);
  vi.stubEnv("AI_API_KEY", "sk-test-secret-key");
  vi.stubEnv("AI_MODEL", "test-model");
  vi.stubEnv("AI_BASE_URL", base);
  vi.stubEnv("AI_TIMEOUT_MS", "2000");
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

beforeEach(() => {
  requests = [];
  handler = (_r, _b, res) => json(res, 200, {});
});
afterEach(() => vi.unstubAllEnvs());

describe("Anthropic adapter", () => {
  it("sends the key, version header, system prompt and image block, and parses fenced JSON", async () => {
    configure("anthropic");
    handler = (_r, _b, res) => json(res, 200, { content: [{ type: "text", text: "```json\n" + JSON.stringify(analysis) + "\n```" }] });
    const out = await getAiProvider()!.completeJson({ system: "SYS", user: "USER", image: { mediaType: "image/jpeg", base64: "QUJD" } });
    expect(out).toEqual(analysis);
    const r = requests[0];
    expect(r.url).toBe("/v1/messages");
    expect(r.headers["x-api-key"]).toBe("sk-test-secret-key");
    expect(r.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(r.body);
    expect(body.model).toBe("test-model");
    expect(body.system).toBe("SYS");
    expect(body.messages[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } });
    expect(body.messages[0].content[1]).toEqual({ type: "text", text: "USER" });
  });
});

describe("OpenAI-compatible adapter", () => {
  it("sends a bearer token, JSON mode and the image as a data URL", async () => {
    configure("openai");
    handler = (_r, _b, res) => json(res, 200, { choices: [{ message: { content: JSON.stringify(analysis) } }] });
    const out = await getAiProvider()!.completeJson({ system: "SYS", user: "USER", image: { mediaType: "image/png", base64: "QUJD" } });
    expect(out).toEqual(analysis);
    const r = requests[0];
    expect(r.url).toBe("/v1/chat/completions");
    expect(r.headers.authorization).toBe("Bearer sk-test-secret-key");
    const body = JSON.parse(r.body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/png;base64,QUJD");
  });
});

describe("failure handling", () => {
  it("retries once on a transient 5xx and then succeeds", async () => {
    configure("openai");
    let n = 0;
    handler = (_r, _b, res) => (++n === 1 ? json(res, 503, { error: "overloaded" }) : json(res, 200, { choices: [{ message: { content: JSON.stringify(analysis) } }] }));
    await expect(getAiProvider()!.completeJson({ system: "s", user: "u" })).resolves.toEqual(analysis);
    expect(requests).toHaveLength(2);
  });

  it("reports a busy provider after repeated 429s, with a friendly message", async () => {
    configure("openai");
    handler = (_r, _b, res) => json(res, 429, { error: "rate limit" });
    await expect(getAiProvider()!.completeJson({ system: "s", user: "u" })).rejects.toMatchObject({ status: 503, code: "ai_busy" });
    expect(requests).toHaveLength(2);
  });

  it("never leaks the API key or provider body in errors, and doesn't retry auth failures", async () => {
    configure("anthropic");
    handler = (_r, _b, res) => json(res, 401, { error: { message: "invalid x-api-key sk-test-secret-key" } });
    const err: { status: number; code: string; message: string } = await getAiProvider()!.completeJson({ system: "s", user: "u" }).then(
      () => { throw new Error("expected a rejection"); },
      (e) => e,
    );
    expect(err).toMatchObject({ status: 503, code: "ai_misconfigured" });
    expect(String(err.message)).not.toMatch(/sk-test|x-api-key/);
    expect(requests).toHaveLength(1);
  });

  it("times out without retrying (no doubled wait or cost)", async () => {
    configure("openai", { AI_TIMEOUT_MS: "150" });
    handler = () => {}; // never responds
    await expect(getAiProvider()!.completeJson({ system: "s", user: "u" })).rejects.toMatchObject({ status: 504, code: "ai_timeout" });
    expect(requests).toHaveLength(1);
  });

  it("rejects a reply that isn't JSON", async () => {
    configure("openai");
    handler = (_r, _b, res) => json(res, 200, { choices: [{ message: { content: "Sorry, I can't help with that." } }] });
    await expect(getAiProvider()!.completeJson({ system: "s", user: "u" })).rejects.toMatchObject({ status: 502, code: "ai_bad_output" });
  });
});

describe("provider selection", () => {
  it("returns null (feature disabled, not faked) when not configured", () => {
    vi.stubEnv("AI_PROVIDER", "none");
    expect(getAiProvider()).toBeNull();
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");
    expect(aiConfig()).toBeNull();
  });
  it("only enables the demo mock outside production, and labels it", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "development");
    expect(getAiProvider()).toMatchObject({ name: "mock", isDemo: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(getAiProvider()).toBeNull();
  });
  it("the mock's output is visibly marked as demo data", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "development");
    const out = (await getAiProvider()!.completeJson({ system: "s", user: "u" })) as { items: { food_name: string; assumptions: string[] }[] };
    expect(out.items[0].food_name).toMatch(/^Demo:/);
    expect(out.items[0].assumptions.join(" ")).toMatch(/not a real AI analysis/);
  });
});
