"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, formatLongDate } from "@/lib/dates";

export function DateNav({ date, today, basePath = "/dashboard" }: { date: string; today: string; basePath?: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(d === today ? basePath : `${basePath}?date=${d}`);
  const isToday = date === today;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Choose date">
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => go(addDays(date, -1))}><ChevronLeft /></Button>
      <label className="relative">
        <span className="sr-only">Pick a date</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && e.target.value <= today && go(e.target.value)}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-medium"
        />
      </label>
      <Button variant="outline" size="icon" aria-label="Next day" disabled={isToday} onClick={() => go(addDays(date, 1))}><ChevronRight /></Button>
      {!isToday && <Button variant="ghost" size="sm" onClick={() => go(today)}>Today</Button>}
      <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">{isToday ? "Today" : formatLongDate(date)}</span>
    </div>
  );
}
