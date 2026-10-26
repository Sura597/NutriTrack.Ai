"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useLogFood } from "@/components/app/log-food-context";
import type { LogRow } from "@/lib/data/logs";

const METHOD_LABEL = { photo: "Photo", text: "Text", voice: "Voice", manual: "Manual" } as const;

export function LogCard({ log, date, showTime = false, timeZone }: { log: LogRow; date: string; showTime?: boolean; timeZone?: string }) {
  const router = useRouter();
  const { openLog } = useLogFood();

  async function remove() {
    const res = await fetch(`/api/food/logs/${log.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete this meal. Please try again.");
      return;
    }
    toast.success("Meal deleted");
    router.refresh();
  }

  const time = showTime
    ? new Date(log.consumed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone })
    : null;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge>{METHOD_LABEL[log.input_method]}</Badge>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
        <div className="ml-auto flex">
          <Button variant="ghost" size="icon" aria-label="Edit meal" onClick={() => openLog({ log, date })}><Pencil /></Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon" aria-label="Delete meal"><Trash2 /></Button>}
            title="Delete this meal?"
            description="This removes the meal and all of its foods from your log."
            onConfirm={remove}
          />
        </div>
      </div>
      <ul className="divide-y divide-border">
        {log.items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{it.food_name}</p>
              <p className="text-xs text-muted-foreground">
                {it.quantity} {it.unit}
                {it.estimation_source === "ai" && " · AI estimate"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">{Math.round(it.calories_kcal)} kcal</p>
              <p className="text-xs tabular-nums text-muted-foreground">P {it.protein_g} · C {it.carbs_g} · F {it.fat_g}</p>
            </div>
          </li>
        ))}
      </ul>
      {log.notes && <p className="mt-2 text-xs text-muted-foreground">Note: {log.notes}</p>}
    </div>
  );
}
