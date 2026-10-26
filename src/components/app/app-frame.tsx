"use client";

import { DesktopNav, MobileNav } from "./app-nav";
import { LogFoodProvider, useLogFood } from "./log-food-context";
import { LogFoodDialog } from "@/components/log-food/log-food-dialog";

function Inner({ appName, today, children }: { appName: string; today: string; children: React.ReactNode }) {
  const { openLog } = useLogFood();
  return (
    <div className="min-h-dvh">
      <DesktopNav appName={appName} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-12">{children}</main>
      <MobileNav onLog={() => openLog()} />
      <LogFoodDialog today={today} />
    </div>
  );
}

export function AppFrame({ appName, today, children }: { appName: string; today: string; children: React.ReactNode }) {
  return (
    <LogFoodProvider>
      <Inner appName={appName} today={today}>{children}</Inner>
    </LogFoodProvider>
  );
}
