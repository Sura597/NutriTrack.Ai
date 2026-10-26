import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient, SupabaseNotConfiguredError } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });

export const fail = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });

export interface AuthedContext {
  supabase: SupabaseClient;
  user: User;
  req: Request;
  params: Record<string, string>;
}

type Handler = (ctx: AuthedContext) => Promise<Response>;

/**
 * Wraps a route handler with: authentication (server-verified user), uniform
 * error envelope and status codes, and safe logging (error name only, never
 * request bodies, tokens or user data).
 */
export function authed(handler: Handler) {
  return async (req: Request, routeCtx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return fail(401, "unauthenticated", "Please sign in to continue.");
      const params = (await routeCtx?.params) ?? {};
      return await handler({ supabase, user: data.user, req, params });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.details);
  if (e instanceof SupabaseNotConfiguredError)
    return fail(503, "not_configured", "The server is missing its Supabase configuration. See the README setup steps.");
  if (e instanceof ZodError)
    return fail(400, "invalid_request", "Some fields are missing or invalid.", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  console.error("[api] unhandled error:", e instanceof Error ? e.name : "unknown");
  return fail(500, "internal_error", "Something went wrong. Please try again.");
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

/** Throws a 500 for unexpected database errors without leaking details to the client. */
export function dbError(error: { code?: string; message?: string } | null, context: string): never {
  console.error(`[db] ${context}: ${error?.code ?? "error"}`);
  throw new ApiError(500, "database_error", "We couldn't complete that request. Please try again.");
}
