import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data/session";
import { fetchLogsPage, type LogRow } from "@/lib/data/logs";
import { isDateString, localDateOf, formatLongDate } from "@/lib/dates";
import { sumMacros } from "@/lib/nutrition/aggregate";
import { LogCard } from "@/components/dashboard/log-card";
import { LogFoodButton } from "@/components/dashboard/log-food-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Food log" };
const PAGE_SIZE = 20;

export default async function FoodLogPage({ searchParams }: { searchParams: Promise<{ page?: string; date?: string }> }) {
  const { supabase, settings } = await requireOnboardedUser();
  const sp = await searchParams;
  const tz = settings.time_zone;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const date = sp.date && isDateString(sp.date) ? sp.date : undefined;

  const { logs, total } = await fetchLogsPage(supabase, tz, { date, page, pageSize: PAGE_SIZE });

  // group the page's logs by local calendar day, newest first
  const days = new Map<string, LogRow[]>();
  for (const l of logs) {
    const d = localDateOf(l.consumed_at, tz);
    days.set(d, [...(days.get(d) ?? []), l]);
  }
  const hasMore = page * PAGE_SIZE < total;
  const qs = (p: number) => `/log?${new URLSearchParams({ ...(date ? { date } : {}), page: String(p) })}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Food log</h1>
          <p className="text-sm text-muted-foreground">{total} {total === 1 ? "meal" : "meals"}{date ? ` on ${formatLongDate(date)}` : " logged"}</p>
        </div>
        <form className="flex items-end gap-2" action="/log">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Jump to date</span>
            <input type="date" name="date" defaultValue={date} className="h-10 rounded-xl border border-input bg-card px-3 text-sm" />
          </label>
          <Button type="submit" variant="outline">Go</Button>
          {date && <Button asChild variant="ghost"><Link href="/log">Clear</Link></Button>}
        </form>
      </div>

      {logs.length === 0 ? (
        <EmptyState title={date ? "No meals on this day" : "No meals logged yet"} action={<LogFoodButton date={date} size="default" />}>
          {date ? "Pick another date, or log a meal for this day." : "Log your first meal to start building your history."}
        </EmptyState>
      ) : (
        [...days.entries()].map(([d, dayLogs]) => (
          <Card key={d}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{formatLongDate(d)}</CardTitle>
              <span className="text-sm tabular-nums text-muted-foreground">{sumMacros(dayLogs.flatMap((l) => l.items)).calories_kcal} kcal on this page</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {dayLogs.map((l) => <LogCard key={l.id} log={l} date={d} showTime timeZone={tz} />)}
            </CardContent>
          </Card>
        ))
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="flex justify-between">
          {page > 1 ? <Button asChild variant="outline"><Link href={qs(page - 1)}>Newer</Link></Button> : <span />}
          {hasMore && <Button asChild variant="outline"><Link href={qs(page + 1)}>Older</Link></Button>}
        </nav>
      )}
    </div>
  );
}
