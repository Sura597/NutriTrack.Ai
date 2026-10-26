import { authed, ok, parseJson, parseQuery } from "@/lib/api";
import { createLogSchema, listLogsQuery } from "@/lib/schemas";
import { createLog, fetchLog, fetchLogsPage } from "@/lib/data/logs";
import { userTimeZone } from "@/lib/data/profile";

export const GET = authed(async ({ supabase, user, req }) => {
  const q = parseQuery(req, listLogsQuery);
  const tz = await userTimeZone(supabase, user.id);
  const { logs, total } = await fetchLogsPage(supabase, tz, { date: q.date, from: q.from, to: q.to, page: q.page, pageSize: q.page_size });
  return ok({ logs, page: q.page, page_size: q.page_size, total, has_more: q.page * q.page_size < total });
});

export const POST = authed(async ({ supabase, user, req }) => {
  const input = await parseJson(req, createLogSchema);
  const tz = await userTimeZone(supabase, user.id);
  const id = await createLog(supabase, user.id, tz, input);
  return ok({ log: await fetchLog(supabase, id) }, 201);
});
