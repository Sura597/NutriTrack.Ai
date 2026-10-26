import Link from "next/link";
import { Leaf } from "lucide-react";
import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/format";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Leaf className="size-4" aria-hidden />
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo className="self-center" />
      <Card className="p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </Card>
      {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
    </main>
  );
}
