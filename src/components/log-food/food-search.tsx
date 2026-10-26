"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { draftFromFood, manualDraft, type DraftItem, type FoodLike } from "@/lib/draft";

interface Hit extends FoodLike {
  category: string;
  dietary_type: string;
  source: string;
}

/** Debounced search over the local food table, plus a manual-entry shortcut. */
export function FoodSearch({ onAdd }: { onAdd: (item: DraftItem) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const reqId = useRef(0);

  const term = q.trim();
  const searchable = term.length >= 2;

  useEffect(() => {
    if (!searchable) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(term)}&limit=8`);
        if (id !== reqId.current) return; // a newer request superseded this one
        if (!res.ok) throw new Error();
        const j = await res.json();
        setHits(j.data.foods);
        setState("idle");
      } catch {
        if (id === reqId.current) setState("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term, searchable]);

  // Hide stale results as soon as the query becomes too short to search.
  const shownHits = searchable ? hits : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Search foods"
          placeholder="Search foods, e.g. roti, dal, paneer"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {searchable && state === "error" && <p role="alert" className="text-sm text-destructive">Search isn&apos;t available right now. You can still add a food manually.</p>}
      {searchable && state === "idle" && shownHits.length === 0 && (
        <p className="text-sm text-muted-foreground">No match in the food table. Add it manually below.</p>
      )}
      {shownHits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" aria-label="Search results">
          {shownHits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  onAdd(draftFromFood(h));
                  setQ("");
                  setHits([]);
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{h.food_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {h.serving_quantity} {h.serving_unit} · {Math.round(h.calories_kcal)} kcal · {h.protein_g} g protein
                  </span>
                </span>
                <Plus className="size-4 shrink-0 text-primary" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onAdd(manualDraft(q.trim()))}>
        <Plus /> Enter calories manually
      </Button>
    </div>
  );
}
