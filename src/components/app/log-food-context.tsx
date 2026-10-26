"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { LogRow } from "@/lib/data/logs";

interface OpenOptions {
  /** YYYY-MM-DD the meal belongs to (defaults to the date being viewed). */
  date?: string;
  /** Pass an existing log to edit it. */
  log?: LogRow;
  /** Pre-select a meal (e.g. from an empty "Add lunch" slot). */
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}

interface Ctx {
  state: { open: boolean; session: number; date?: string; log?: LogRow; mealType?: OpenOptions["mealType"] };
  openLog: (opts?: OpenOptions) => void;
  close: () => void;
}

const LogFoodContext = createContext<Ctx | null>(null);

export function LogFoodProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Ctx["state"]>({ open: false, session: 0 });
  const openLog = useCallback((opts?: OpenOptions) => setState((prev) => ({ open: true, session: prev.session + 1, date: opts?.date, log: opts?.log, mealType: opts?.mealType })), []);
  const close = useCallback(() => setState((prev) => ({ ...prev, open: false })), []);
  const value = useMemo(() => ({ state, openLog, close }), [state, openLog, close]);
  return <LogFoodContext.Provider value={value}>{children}</LogFoodContext.Provider>;
}

export function useLogFood() {
  const ctx = useContext(LogFoodContext);
  if (!ctx) throw new Error("useLogFood must be used inside <LogFoodProvider>");
  return ctx;
}
