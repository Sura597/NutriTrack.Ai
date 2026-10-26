"use client";

import { DesktopNav, MobileNav } from "./app-nav";

export function AppFrame({ appName, children }: { appName: string; userName: string; timeZone: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <DesktopNav appName={appName} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
