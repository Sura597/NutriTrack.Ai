"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Home, Leaf, ListChecks, Plus, Salad, User } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
  { href: "/log", label: "Food Log", short: "Log", icon: ListChecks },
  { href: "/insights", label: "Insights", short: "Insights", icon: BarChart3 },
  { href: "/foods", label: "Affordable Foods", short: "Foods", icon: Salad },
  { href: "/plan", label: "Diet Plan", short: "Plan", icon: CalendarDays },
  { href: "/profile", label: "Profile & Settings", short: "Profile", icon: User },
];

export function DesktopNav({ appName }: { appName: string }) {
  const path = usePathname();
  return (
    <header className="hidden border-b border-border bg-card md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-4" aria-hidden /></span>
          {appName}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                <l.icon className="size-4" aria-hidden />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action="/auth/sign-out" method="post" className="ml-auto">
          <button className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted" type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}

export function MobileNav({ onLog }: { onLog?: () => void }) {
  const path = usePathname();
  const item = (l: (typeof links)[number]) => {
    const active = path === l.href || path.startsWith(`${l.href}/`);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
      >
        <l.icon className="size-5" aria-hidden />
        {l.short}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {item(links[0])}
        {item(links[2])}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onLog}
            aria-label="Log food"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
          >
            <Plus className="size-7" aria-hidden />
          </button>
        </div>
        {item(links[3])}
        {item(links[5])}
      </div>
    </nav>
  );
}
