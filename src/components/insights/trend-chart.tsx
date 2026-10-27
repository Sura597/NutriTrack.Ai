"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  unit: string;
  color: string;
  target: number | null;
  /** One point per day; value is null for days with nothing logged. */
  points: { day: string; value: number | null }[];
}

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** One series per chart (the title names it); days with no log are left empty, not drawn as zero intake. */
export function TrendChart({ title, unit, color, target, points }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const data = points.map((d) => ({ day: d.day, value: d.value === null ? null : Math.round(d.value) }));
  const hasData = data.some((d) => d.value !== null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setView(view === "chart" ? "table" : "chart")} aria-pressed={view === "table"}>
          {view === "chart" ? "View as table" : "View chart"}
        </Button>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing logged in this period yet.</p>
        ) : view === "table" ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{title} by day</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 text-right font-medium">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.day} className="border-t border-border">
                    <td className="py-1">{shortDay(d.day)}</td>
                    <td className="py-1 text-right tabular-nums">{d.value ?? "Not logged"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-60" role="img" aria-label={`${title} bar chart by day${target ? `, target ${target} ${unit}` : ""}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} stroke="var(--muted-foreground)" />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  labelFormatter={(l) => shortDay(String(l))}
                  formatter={(v) => [`${v} ${unit}`, title]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 13 }}
                />
                {target ? <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: `Target ${target}`, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }} /> : null}
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
